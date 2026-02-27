use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::auth;
use crate::models::*;
use crate::sync;

#[tauri::command]
pub async fn listar_observaciones(
    pool: State<'_, SqlitePool>,
    token: String,
    id_certificacion: String,
) -> Result<Vec<ObservacionDetalle>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    let results = sqlx::query_as::<_, ObservacionDetalle>(
        "SELECT
            o.id, o.id_certificacion,
            pf.nombre_completo as creado_por_nombre,
            o.comentario, o.created_at
        FROM observacion_certificacion o
        INNER JOIN usuario u ON o.creado_por = u.id
        INNER JOIN perfil pf ON pf.id_usuario = u.id
        WHERE o.id_certificacion = ?
        ORDER BY o.created_at DESC"
    )
    .bind(&id_certificacion)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando observaciones: {}", e))?;

    Ok(results)
}

#[tauri::command]
pub async fn crear_observacion(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: CrearObservacion,
) -> Result<ObservacionDetalle, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos para crear observaciones".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO observacion_certificacion (id, id_certificacion, creado_por, comentario, sync_status) VALUES (?, ?, ?, ?, 'pending')"
    )
    .bind(&id)
    .bind(&data.id_certificacion)
    .bind(&claims.sub)
    .bind(&data.comentario)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando observación: {}", e))?;

    let result = sqlx::query_as::<_, ObservacionDetalle>(
        "SELECT
            o.id, o.id_certificacion,
            pf.nombre_completo as creado_por_nombre,
            o.comentario, o.created_at
        FROM observacion_certificacion o
        INNER JOIN usuario u ON o.creado_por = u.id
        INNER JOIN perfil pf ON pf.id_usuario = u.id
        WHERE o.id = ?"
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?;

    // Attempt immediate push while online (best-effort)
    sync::try_push(config.inner(), auth_token.inner(), pool.inner()).await;

    Ok(result)
}
