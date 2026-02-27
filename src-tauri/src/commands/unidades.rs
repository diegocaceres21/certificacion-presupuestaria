use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::api_forward;
use crate::auth;
use crate::models::*;

// ============================================
// Dependencias
// ============================================
#[tauri::command]
pub async fn listar_dependencias(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<Vec<Dependencia>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    sqlx::query_as::<_, Dependencia>(
        "SELECT * FROM dependencia ORDER BY codigo"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando dependencias: {}", e))
}

#[tauri::command]
pub async fn crear_dependencia(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: CrearDependencia,
) -> Result<Dependencia, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO dependencia (id, codigo, dependencia, sync_status, sync_operation) VALUES (?, ?, ?, 'pending', 'create')")
        .bind(&id)
        .bind(&data.codigo)
        .bind(&data.dependencia)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando dependencia: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::post(&config, &auth_token, "dependencias", &serde_json::json!({
        "id": id,
        "codigo": data.codigo,
        "dependencia": data.dependencia,
    })).await;
    if synced {
        sqlx::query("UPDATE dependencia SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, Dependencia>("SELECT * FROM dependencia WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_dependencia(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
    data: EditarDependencia,
) -> Result<Dependencia, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let current = sqlx::query_as::<_, Dependencia>("SELECT * FROM dependencia WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))?
        .ok_or_else(|| "Dependencia no encontrada".to_string())?;

    let codigo = data.codigo.unwrap_or(current.codigo);
    let dependencia = data.dependencia.unwrap_or(current.dependencia);
    let activo = data.activo.unwrap_or(current.activo);

    sqlx::query("UPDATE dependencia SET codigo = ?, dependencia = ?, activo = ?, sync_status = 'pending', sync_operation = CASE WHEN sync_operation = 'create' THEN 'create' ELSE 'update' END WHERE id = ?")
        .bind(&codigo)
        .bind(&dependencia)
        .bind(activo)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando dependencia: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::put(&config, &auth_token, "dependencias", &id, &serde_json::json!({
        "codigo": codigo,
        "dependencia": dependencia,
        "activo": activo,
    })).await;
    if synced {
        sqlx::query("UPDATE dependencia SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, Dependencia>("SELECT * FROM dependencia WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

// ============================================
// Unidades Organizacionales
// ============================================
#[tauri::command]
pub async fn listar_unidades(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<Vec<UnidadConDependencia>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    sqlx::query_as::<_, UnidadConDependencia>(
        "SELECT
            uo.id, uo.id_dependencia, uo.codigo, uo.unidad, uo.activo,
            d.codigo as dependencia_codigo, d.dependencia as dependencia_nombre
        FROM unidad_organizacional uo
        INNER JOIN dependencia d ON uo.id_dependencia = d.id
        ORDER BY uo.codigo"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando unidades: {}", e))
}

#[tauri::command]
pub async fn crear_unidad(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: CrearUnidad,
) -> Result<UnidadConDependencia, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO unidad_organizacional (id, id_dependencia, codigo, unidad, sync_status, sync_operation) VALUES (?, ?, ?, ?, 'pending', 'create')")
        .bind(&id)
        .bind(&data.id_dependencia)
        .bind(data.codigo)
        .bind(&data.unidad)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando unidad: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::post(&config, &auth_token, "unidades", &serde_json::json!({
        "id": id,
        "id_dependencia": data.id_dependencia,
        "codigo": data.codigo,
        "unidad": data.unidad,
    })).await;
    if synced {
        sqlx::query("UPDATE unidad_organizacional SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, UnidadConDependencia>(
        "SELECT
            uo.id, uo.id_dependencia, uo.codigo, uo.unidad, uo.activo,
            d.codigo as dependencia_codigo, d.dependencia as dependencia_nombre
        FROM unidad_organizacional uo
        INNER JOIN dependencia d ON uo.id_dependencia = d.id
        WHERE uo.id = ?"
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_unidad(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
    data: EditarUnidad,
) -> Result<UnidadConDependencia, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let current = sqlx::query_as::<_, UnidadOrganizacional>(
        "SELECT * FROM unidad_organizacional WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?
    .ok_or_else(|| "Unidad no encontrada".to_string())?;

    let id_dependencia = data.id_dependencia.unwrap_or(current.id_dependencia);
    let codigo = data.codigo.unwrap_or(current.codigo);
    let unidad = data.unidad.unwrap_or(current.unidad);
    let activo = data.activo.unwrap_or(current.activo);

    sqlx::query("UPDATE unidad_organizacional SET id_dependencia = ?, codigo = ?, unidad = ?, activo = ?, sync_status = 'pending', sync_operation = CASE WHEN sync_operation = 'create' THEN 'create' ELSE 'update' END WHERE id = ?")
        .bind(&id_dependencia)
        .bind(codigo)
        .bind(&unidad)
        .bind(activo)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando unidad: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::put(&config, &auth_token, "unidades", &id, &serde_json::json!({
        "id_dependencia": id_dependencia,
        "codigo": codigo,
        "unidad": unidad,
        "activo": activo,
    })).await;
    if synced {
        sqlx::query("UPDATE unidad_organizacional SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, UnidadConDependencia>(
        "SELECT
            uo.id, uo.id_dependencia, uo.codigo, uo.unidad, uo.activo,
            d.codigo as dependencia_codigo, d.dependencia as dependencia_nombre
        FROM unidad_organizacional uo
        INNER JOIN dependencia d ON uo.id_dependencia = d.id
        WHERE uo.id = ?"
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))
}
