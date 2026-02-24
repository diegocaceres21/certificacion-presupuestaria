use sqlx::MySqlPool;
use tauri::State;
use uuid::Uuid;

use crate::auth;
use crate::models::*;

#[tauri::command]
pub async fn listar_proyectos(
    pool: State<'_, MySqlPool>,
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
    pool: State<'_, MySqlPool>,
    token: String,
    data: CrearProyecto,
) -> Result<Proyecto, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO proyecto (id, nombre, descripcion, pei) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&data.nombre)
        .bind(&data.descripcion)
        .bind(&data.pei)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando proyecto: {}", e))?;

    sqlx::query_as::<_, Proyecto>("SELECT * FROM proyecto WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_proyecto(
    pool: State<'_, MySqlPool>,
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

    sqlx::query("UPDATE proyecto SET nombre = ?, descripcion = ?, pei = ?, activo = ? WHERE id = ?")
        .bind(data.nombre.unwrap_or(current.nombre))
        .bind(data.descripcion.or(current.descripcion))
        .bind(data.pei.or(current.pei))
        .bind(data.activo.unwrap_or(current.activo))
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando proyecto: {}", e))?;

    sqlx::query_as::<_, Proyecto>("SELECT * FROM proyecto WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}
