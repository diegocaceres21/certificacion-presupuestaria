use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::api_forward;
use crate::auth;
use crate::models::*;

#[tauri::command]
pub async fn listar_usuarios(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<Vec<UsuarioConPerfil>, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol != "administrador" {
        return Err("Solo administradores pueden ver la lista de usuarios".to_string());
    }

    sqlx::query_as::<_, UsuarioConPerfil>(
        "SELECT
            u.id, u.usuario, u.activo,
            p.nombre_completo, p.cargo, p.rol
        FROM usuario u
        INNER JOIN perfil p ON p.id_usuario = u.id
        ORDER BY p.nombre_completo"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando usuarios: {}", e))
}

#[tauri::command]
pub async fn listar_usuarios_simple(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<Vec<UsuarioConPerfil>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    sqlx::query_as::<_, UsuarioConPerfil>(
        "SELECT
            u.id, u.usuario, u.activo,
            p.nombre_completo, p.cargo, p.rol
        FROM usuario u
        INNER JOIN perfil p ON p.id_usuario = u.id
        WHERE u.activo = 1
        ORDER BY p.nombre_completo"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando usuarios: {}", e))
}

#[tauri::command]
pub async fn crear_usuario(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: CrearUsuario,
) -> Result<UsuarioConPerfil, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol != "administrador" {
        return Err("Solo administradores pueden crear usuarios".to_string());
    }

    let user_id = Uuid::new_v4().to_string();
    let perfil_id = Uuid::new_v4().to_string();

    let hashed = auth::hash_password(&data.password)
        .map_err(|e| format!("Error hasheando contraseña: {}", e))?;

    sqlx::query("INSERT INTO usuario (id, usuario, password) VALUES (?, ?, ?)")
        .bind(&user_id)
        .bind(&data.usuario)
        .bind(&hashed)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando usuario: {}", e))?;

    sqlx::query("INSERT INTO perfil (id, id_usuario, nombre_completo, cargo, rol) VALUES (?, ?, ?, ?, ?)")
        .bind(&perfil_id)
        .bind(&user_id)
        .bind(&data.nombre_completo)
        .bind(&data.cargo)
        .bind(&data.rol)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando perfil: {}", e))?;

    // Forward to REST API (best-effort)
    api_forward::post(&config, &auth_token, "usuarios", &serde_json::json!({
        "id": user_id,
        "perfilId": perfil_id,
        "usuario": data.usuario,
        "password": data.password,
        "nombre_completo": data.nombre_completo,
        "cargo": data.cargo,
        "rol": data.rol,
    })).await;

    sqlx::query_as::<_, UsuarioConPerfil>(
        "SELECT u.id, u.usuario, u.activo, p.nombre_completo, p.cargo, p.rol
         FROM usuario u INNER JOIN perfil p ON p.id_usuario = u.id WHERE u.id = ?"
    )
    .bind(&user_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_usuario(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
    data: EditarUsuario,
) -> Result<UsuarioConPerfil, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol != "administrador" {
        return Err("Solo administradores pueden editar usuarios".to_string());
    }

    if let Some(activo) = data.activo {
        sqlx::query("UPDATE usuario SET activo = ? WHERE id = ?")
            .bind(activo)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Error: {}", e))?;
    }

    let current_perfil = sqlx::query_as::<_, Perfil>(
        "SELECT * FROM perfil WHERE id_usuario = ?"
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?;

    let nombre_completo = data.nombre_completo.unwrap_or(current_perfil.nombre_completo);
    let cargo = data.cargo.unwrap_or(current_perfil.cargo);
    let rol = data.rol.unwrap_or(current_perfil.rol);

    sqlx::query("UPDATE perfil SET nombre_completo = ?, cargo = ?, rol = ? WHERE id_usuario = ?")
        .bind(&nombre_completo)
        .bind(&cargo)
        .bind(&rol)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando perfil: {}", e))?;

    // Forward to REST API (best-effort)
    api_forward::put(&config, &auth_token, "usuarios", &id, &serde_json::json!({
        "nombre_completo": nombre_completo,
        "cargo": cargo,
        "rol": rol,
        "activo": data.activo,
    })).await;

    sqlx::query_as::<_, UsuarioConPerfil>(
        "SELECT u.id, u.usuario, u.activo, p.nombre_completo, p.cargo, p.rol
         FROM usuario u INNER JOIN perfil p ON p.id_usuario = u.id WHERE u.id = ?"
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn resetear_password(
    pool: State<'_, SqlitePool>,
    token: String,
    id: String,
    nueva_password: String,
) -> Result<String, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol != "administrador" {
        return Err("Solo administradores pueden resetear contraseñas".to_string());
    }

    let hashed = auth::hash_password(&nueva_password)
        .map_err(|e| format!("Error: {}", e))?;

    sqlx::query("UPDATE usuario SET password = ? WHERE id = ?")
        .bind(&hashed)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))?;

    Ok("Contraseña reseteada correctamente".to_string())
}
