use sqlx::MySqlPool;
use tauri::State;
use uuid::Uuid;

use crate::auth;
use crate::models::*;

#[tauri::command]
pub async fn listar_cuentas(
    pool: State<'_, MySqlPool>,
    token: String,
) -> Result<Vec<CuentaContableDetalle>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    sqlx::query_as::<_, CuentaContableDetalle>(
        "SELECT c.id, c.id_tipo_cuenta, c.id_cuenta_padre, c.codigo, c.cuenta, c.activo,
                tc.tipo AS tipo_cuenta_nombre,
                cp.codigo AS cuenta_padre_codigo,
                cp.cuenta AS cuenta_padre_nombre
         FROM cuenta_contable c
         INNER JOIN tipo_cuenta tc ON tc.id = c.id_tipo_cuenta
         LEFT JOIN cuenta_contable cp ON cp.id = c.id_cuenta_padre
         ORDER BY c.codigo"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error listando cuentas: {}", e))
}

#[tauri::command]
pub async fn crear_cuenta(
    pool: State<'_, MySqlPool>,
    token: String,
    data: CrearCuenta,
) -> Result<CuentaContable, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO cuenta_contable (id, id_tipo_cuenta, id_cuenta_padre, codigo, cuenta) VALUES (?, ?, ?, ?, ?)"
    )
        .bind(&id)
        .bind(&data.id_tipo_cuenta)
        .bind(&data.id_cuenta_padre)
        .bind(data.codigo)
        .bind(&data.cuenta)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando cuenta: {}", e))?;

    sqlx::query_as::<_, CuentaContable>("SELECT * FROM cuenta_contable WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_cuenta(
    pool: State<'_, MySqlPool>,
    token: String,
    id: String,
    data: EditarCuenta,
) -> Result<CuentaContable, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let current = sqlx::query_as::<_, CuentaContable>("SELECT * FROM cuenta_contable WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))?
        .ok_or_else(|| "Cuenta no encontrada".to_string())?;

    let new_padre = match data.id_cuenta_padre {
        Some(v) => v,
        None => current.id_cuenta_padre.clone(),
    };

    sqlx::query(
        "UPDATE cuenta_contable SET id_tipo_cuenta = ?, id_cuenta_padre = ?, codigo = ?, cuenta = ?, activo = ? WHERE id = ?"
    )
        .bind(data.id_tipo_cuenta.unwrap_or(current.id_tipo_cuenta.clone()))
        .bind(&new_padre)
        .bind(data.codigo.unwrap_or(current.codigo))
        .bind(data.cuenta.unwrap_or(current.cuenta))
        .bind(data.activo.unwrap_or(current.activo))
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando cuenta: {}", e))?;

    sqlx::query_as::<_, CuentaContable>("SELECT * FROM cuenta_contable WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}
