use reqwest::Client;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::auth;
use crate::models::{ApiConfig, AuthToken, LoginRequest, LoginResponse, UserInfo};
use crate::sync;

/// Response from the remote server /api/auth/login
#[derive(Debug, Deserialize)]
struct ServerLoginResponse {
    token: String,
    user: ServerUserInfo,
}

#[derive(Debug, Deserialize)]
struct ServerUserInfo {
    id: String,
    usuario: String,
    nombre_completo: String,
    cargo: String,
    rol: String,
}

/// Outcome of a remote login attempt.
enum RemoteLoginOutcome {
    /// Credentials accepted by the server.
    Success(LoginResponse),
    /// Server reachable but credentials rejected (401/403) — do NOT fall back locally.
    Unauthorized(String),
    /// Server unreachable (network error, timeout, not configured) — safe to fall back.
    Unreachable(String),
}

#[tauri::command]
pub async fn login(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    request: LoginRequest,
) -> Result<LoginResponse, String> {
    // ── Step 1: Try the REST API first ───────────────────────────────────────
    // This ensures new users, deactivated accounts, and changed passwords are
    // always picked up from the authoritative source.
    match login_remote_classified(&config, &request).await {
        RemoteLoginOutcome::Success(response) => {
            // Store the JWT so subsequent Tauri commands and sync can use it.
            if let Ok(mut guard) = auth_token.token.lock() {
                *guard = Some(response.token.clone());
            }

            // Pull the whole cloud DB into SQLite.
            // On a fresh device (no last_sync) this is a full replication.
            // On subsequent logins it brings in any changes made elsewhere.
            let api_url = config.base_url.as_deref().unwrap_or("");
            if let Err(e) = sync::pull_after_login(pool.inner(), api_url, &response.token).await {
                log::warn!("Post-login sync failed (non-fatal): {}", e);
            }

            return Ok(response);
        }

        // Wrong credentials confirmed by the server — fail immediately,
        // do NOT allow the stale local copy to bypass the server's decision.
        RemoteLoginOutcome::Unauthorized(err) => {
            return Err(err);
        }

        // Network/config error — fall through to offline fallback below.
        RemoteLoginOutcome::Unreachable(reason) => {
            log::info!("REST API unreachable ({}). Falling back to local SQLite.", reason);
        }
    }

    // ── Step 2: Offline fallback — local SQLite only ─────────────────────────
    // Reached only when the REST API could not be contacted at all.
    let local_result = login_local(pool.inner(), &request).await;
    match local_result {
        Ok(response) => {
            if let Ok(mut guard) = auth_token.token.lock() {
                *guard = Some(response.token.clone());
            }
            Ok(response)
        }
        Err(local_err) => {
            Err(format!(
                "{}. (El servidor tampoco está disponible en este momento.)",
                local_err
            ))
        }
    }
}

/// Authenticate against the local SQLite database.
async fn login_local(pool: &SqlitePool, request: &LoginRequest) -> Result<LoginResponse, String> {
    let row = sqlx::query_as::<_, (String, String, bool)>(
        "SELECT u.id, u.password, u.activo FROM usuario u WHERE u.usuario = ?"
    )
    .bind(&request.usuario)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Error de base de datos: {}", e))?;

    let (user_id, hashed_password, activo) = row
        .ok_or_else(|| "Usuario o contraseña incorrectos".to_string())?;

    if !activo {
        return Err("Usuario desactivado. Contacte al administrador.".to_string());
    }

    let valid = auth::verify_password(&request.password, &hashed_password)
        .map_err(|e| format!("Error verificando contraseña: {}", e))?;

    if !valid {
        return Err("Usuario o contraseña incorrectos".to_string());
    }

    let perfil = sqlx::query_as::<_, (String, String, String)>(
        "SELECT p.nombre_completo, p.cargo, p.rol FROM perfil p WHERE p.id_usuario = ?"
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Error obteniendo perfil: {}", e))?;

    let token = auth::create_token(&user_id, &perfil.2, &perfil.0)
        .map_err(|e| format!("Error creando token: {}", e))?;

    Ok(LoginResponse {
        token,
        user: UserInfo {
            id: user_id,
            usuario: request.usuario.clone(),
            nombre_completo: perfil.0,
            cargo: perfil.1,
            rol: perfil.2,
        },
    })
}

/// Authenticate against the remote server, returning a typed outcome so the
/// caller can distinguish "wrong password" from "server unreachable".
async fn login_remote_classified(config: &ApiConfig, request: &LoginRequest) -> RemoteLoginOutcome {
    let base_url = match config.base_url.as_deref() {
        Some(url) => url.to_string(),
        None => return RemoteLoginOutcome::Unreachable("Servidor no configurado".to_string()),
    };

    let client = match Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => return RemoteLoginOutcome::Unreachable(format!("Error de red: {}", e)),
    };

    let resp = match client
        .post(format!("{}/api/auth/login", base_url))
        .json(&serde_json::json!({
            "usuario": request.usuario,
            "password": request.password,
        }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return RemoteLoginOutcome::Unreachable(format!("No se pudo conectar: {}", e)),
    };

    let status = resp.status();

    // 401 / 403 — server explicitly rejected the credentials.
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        let body = resp.text().await.unwrap_or_default();
        // Try to extract the "error" field from JSON, fall back to raw body.
        let message = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v["error"].as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "Usuario o contraseña incorrectos".to_string());
        return RemoteLoginOutcome::Unauthorized(message);
    }

    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return RemoteLoginOutcome::Unreachable(format!("Servidor respondió {}: {}", status, body));
    }

    match resp.json::<ServerLoginResponse>().await {
        Ok(server_resp) => RemoteLoginOutcome::Success(LoginResponse {
            token: server_resp.token,
            user: UserInfo {
                id: server_resp.user.id,
                usuario: server_resp.user.usuario,
                nombre_completo: server_resp.user.nombre_completo,
                cargo: server_resp.user.cargo,
                rol: server_resp.user.rol,
            },
        }),
        Err(e) => RemoteLoginOutcome::Unreachable(format!("Error parseando respuesta: {}", e)),
    }
}

#[tauri::command]
pub async fn verify_token(
    auth_token: State<'_, AuthToken>,
    token: String,
) -> Result<UserInfo, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    // Keep the token available for sync
    if let Ok(mut guard) = auth_token.token.lock() {
        *guard = Some(token);
    }

    Ok(UserInfo {
        id: claims.sub,
        usuario: String::new(),
        nombre_completo: claims.nombre,
        cargo: String::new(),
        rol: claims.rol,
    })
}

/// Clear the stored auth token (called on logout).
#[tauri::command]
pub async fn logout(auth_token: State<'_, AuthToken>) -> Result<(), String> {
    if let Ok(mut guard) = auth_token.token.lock() {
        *guard = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn cambiar_password(
    pool: State<'_, SqlitePool>,
    token: String,
    password_actual: String,
    password_nueva: String,
) -> Result<String, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    let row = sqlx::query_as::<_, (String,)>(
        "SELECT password FROM usuario WHERE id = ?"
    )
    .bind(&claims.sub)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?;

    let valid = auth::verify_password(&password_actual, &row.0)
        .map_err(|e| format!("Error: {}", e))?;

    if !valid {
        return Err("Contraseña actual incorrecta".to_string());
    }

    let new_hash = auth::hash_password(&password_nueva)
        .map_err(|e| format!("Error: {}", e))?;

    sqlx::query("UPDATE usuario SET password = ? WHERE id = ?")
        .bind(&new_hash)
        .bind(&claims.sub)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))?;

    Ok("Contraseña actualizada correctamente".to_string())
}
