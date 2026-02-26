use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::auth;
use crate::models::*;

#[tauri::command]
pub async fn listar_tipo_cuentas(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<Vec<TipoCuenta>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    sqlx::query_as::<_, TipoCuenta>(
        "SELECT * FROM tipo_cuenta ORDER BY tipo"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando tipos de cuenta: {}", e))
}

#[tauri::command]
pub async fn crear_tipo_cuenta(
    pool: State<'_, SqlitePool>,
    token: String,
    data: CrearTipoCuenta,
) -> Result<TipoCuenta, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO tipo_cuenta (id, tipo) VALUES (?, ?)")
        .bind(&id)
        .bind(&data.tipo)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando tipo de cuenta: {}", e))?;

    sqlx::query_as::<_, TipoCuenta>("SELECT * FROM tipo_cuenta WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_tipo_cuenta(
    pool: State<'_, SqlitePool>,
    token: String,
    id: String,
    data: EditarTipoCuenta,
) -> Result<TipoCuenta, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let current = sqlx::query_as::<_, TipoCuenta>("SELECT * FROM tipo_cuenta WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))?
        .ok_or_else(|| "Tipo de cuenta no encontrado".to_string())?;

    sqlx::query("UPDATE tipo_cuenta SET tipo = ?, activo = ? WHERE id = ?")
        .bind(data.tipo.unwrap_or(current.tipo))
        .bind(data.activo.unwrap_or(current.activo))
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando tipo de cuenta: {}", e))?;

    sqlx::query_as::<_, TipoCuenta>("SELECT * FROM tipo_cuenta WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}
