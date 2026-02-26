use sqlx::SqlitePool;
use tauri::State;

use crate::auth;
use crate::models::{LoginRequest, LoginResponse, UserInfo};

#[tauri::command]
pub async fn login(
    pool: State<'_, SqlitePool>,
    request: LoginRequest,
) -> Result<LoginResponse, String> {
    let row = sqlx::query_as::<_, (String, String, bool)>(
        "SELECT u.id, u.password, u.activo FROM usuario u WHERE u.usuario = ?"
    )
    .bind(&request.usuario)
    .fetch_optional(pool.inner())
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
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error obteniendo perfil: {}", e))?;

    let token = auth::create_token(&user_id, &perfil.2, &perfil.0)
        .map_err(|e| format!("Error creando token: {}", e))?;

    Ok(LoginResponse {
        token,
        user: UserInfo {
            id: user_id,
            usuario: request.usuario,
            nombre_completo: perfil.0,
            cargo: perfil.1,
            rol: perfil.2,
        },
    })
}

#[tauri::command]
pub async fn verify_token(token: String) -> Result<UserInfo, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    Ok(UserInfo {
        id: claims.sub,
        usuario: String::new(),
        nombre_completo: claims.nombre,
        cargo: String::new(),
        rol: claims.rol,
    })
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
