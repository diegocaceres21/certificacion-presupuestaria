use sqlx::MySqlPool;
use tauri::State;
use uuid::Uuid;

use crate::auth;
use crate::models::*;

// ============================================
// Dependencias
// ============================================
#[tauri::command]
pub async fn listar_dependencias(
    pool: State<'_, MySqlPool>,
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
    pool: State<'_, MySqlPool>,
    token: String,
    data: CrearDependencia,
) -> Result<Dependencia, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO dependencia (id, codigo, dependencia) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&data.codigo)
        .bind(&data.dependencia)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando dependencia: {}", e))?;

    sqlx::query_as::<_, Dependencia>("SELECT * FROM dependencia WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_dependencia(
    pool: State<'_, MySqlPool>,
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

    sqlx::query("UPDATE dependencia SET codigo = ?, dependencia = ?, activo = ? WHERE id = ?")
        .bind(data.codigo.unwrap_or(current.codigo))
        .bind(data.dependencia.unwrap_or(current.dependencia))
        .bind(data.activo.unwrap_or(current.activo))
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando dependencia: {}", e))?;

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
    pool: State<'_, MySqlPool>,
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
    pool: State<'_, MySqlPool>,
    token: String,
    data: CrearUnidad,
) -> Result<UnidadConDependencia, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO unidad_organizacional (id, id_dependencia, codigo, unidad) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&data.id_dependencia)
        .bind(data.codigo)
        .bind(&data.unidad)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando unidad: {}", e))?;

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
    pool: State<'_, MySqlPool>,
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

    sqlx::query("UPDATE unidad_organizacional SET id_dependencia = ?, codigo = ?, unidad = ?, activo = ? WHERE id = ?")
        .bind(data.id_dependencia.unwrap_or(current.id_dependencia))
        .bind(data.codigo.unwrap_or(current.codigo))
        .bind(data.unidad.unwrap_or(current.unidad))
        .bind(data.activo.unwrap_or(current.activo))
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando unidad: {}", e))?;

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
