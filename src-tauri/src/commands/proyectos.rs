use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::api_forward;
use crate::auth;
use crate::models::*;

#[tauri::command]
pub async fn listar_proyectos(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<Vec<Proyecto>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    sqlx::query_as::<_, Proyecto>(
        "SELECT * FROM proyecto ORDER BY nombre"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando proyectos: {}", e))
}

#[tauri::command]
pub async fn crear_proyecto(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: CrearProyecto,
) -> Result<Proyecto, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO proyecto (id, nombre, descripcion, pei, sync_status, sync_operation) VALUES (?, ?, ?, ?, 'pending', 'create')")
        .bind(&id)
        .bind(&data.nombre)
        .bind(&data.descripcion)
        .bind(&data.pei)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando proyecto: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::post(&config, &auth_token, "proyectos", &serde_json::json!({
        "id": id,
        "nombre": data.nombre,
        "descripcion": data.descripcion,
        "pei": data.pei,
    })).await;
    if synced {
        sqlx::query("UPDATE proyecto SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, Proyecto>("SELECT * FROM proyecto WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_proyecto(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
    data: EditarProyecto,
) -> Result<Proyecto, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let current = sqlx::query_as::<_, Proyecto>("SELECT * FROM proyecto WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))?
        .ok_or_else(|| "Proyecto no encontrado".to_string())?;

    let nombre = data.nombre.unwrap_or(current.nombre);
    let descripcion = data.descripcion.or(current.descripcion);
    let pei = data.pei.or(current.pei);
    let activo = data.activo.unwrap_or(current.activo);

    sqlx::query("UPDATE proyecto SET nombre = ?, descripcion = ?, pei = ?, activo = ?, sync_status = 'pending', sync_operation = CASE WHEN sync_operation = 'create' THEN 'create' ELSE 'update' END WHERE id = ?")
        .bind(&nombre)
        .bind(&descripcion)
        .bind(&pei)
        .bind(activo)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando proyecto: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::put(&config, &auth_token, "proyectos", &id, &serde_json::json!({
        "nombre": nombre,
        "descripcion": descripcion,
        "pei": pei,
        "activo": activo,
    })).await;
    if synced {
        sqlx::query("UPDATE proyecto SET sync_status = 'synced' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, Proyecto>("SELECT * FROM proyecto WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}
