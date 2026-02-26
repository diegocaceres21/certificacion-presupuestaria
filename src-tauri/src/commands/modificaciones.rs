use sqlx::SqlitePool;
use tauri::State;

use crate::auth;
use crate::models::*;

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
        ORDER BY m.fecha_hora DESC"
    )
    .bind(&id_certificacion)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando modificaciones: {}", e))?;

    Ok(results)
}
