use chrono::Local;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::auth;
use crate::models::*;
use crate::sync;

#[tauri::command]
pub async fn listar_modificaciones(
    pool: State<'_, SqlitePool>,
    token: String,
    id_certificacion: String,
) -> Result<Vec<ModificacionDetalle>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    let results = sqlx::query_as::<_, ModificacionDetalle>(
        "SELECT
            m.id, m.id_certificacion,
            pf.nombre_completo as modificado_por_nombre,
            m.monto_antiguo, m.monto_nuevo,
            m.concepto_antiguo, m.concepto_nuevo,
            m.fecha_hora, m.comentario
        FROM modificacion m
        INNER JOIN usuario u ON m.modificado_por = u.id
        INNER JOIN perfil pf ON pf.id_usuario = u.id
        WHERE m.id_certificacion = ? AND m.deleted_at IS NULL
        ORDER BY m.fecha_hora ASC"
    )  
    .bind(&id_certificacion) 
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando modificaciones: {}", e))?;

    Ok(results)
}

#[tauri::command]
pub async fn crear_modificacion(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: NuevoModificacion,
) -> Result<(), String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    let id = Uuid::new_v4().to_string();
    let now = Local::now().naive_local().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO modificacion 
        (id, id_certificacion, modificado_por, monto_antiguo, monto_nuevo, concepto_antiguo, concepto_nuevo, fecha_hora, comentario, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
    )
    .bind(&id)
    .bind(&data.id_certificacion)
    .bind(&claims.sub)
    .bind(&data.monto_antiguo)
    .bind(&data.monto_nuevo)
    .bind(&data.concepto_antiguo)
    .bind(&data.concepto_nuevo)
    .bind(&now)
    .bind(&data.comentario)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando modificación: {}", e))?;

    sync::try_push(config.inner(), auth_token.inner(), pool.inner()).await;

    Ok(())
}
