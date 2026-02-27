use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::api_forward;
use crate::auth;
use crate::models::*;

/// Calcula el nivel de una cuenta a partir de la longitud de su código.
fn calcular_nivel(codigo: &str) -> Result<i32, String> {
    match codigo.len() {
        1 => Ok(1),
        2 => Ok(2),
        3 => Ok(3),
        5 => Ok(4),
        8 => Ok(5),
        _ => Err(format!(
            "Longitud de código inválida ({}). Longitudes válidas: 1 (nivel 1), 2 (nivel 2), 3 (nivel 3), 5 (nivel 4), 8 (nivel 5)",
            codigo.len()
        )),
    }
}

#[tauri::command]
pub async fn listar_cuentas(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<Vec<CuentaContableDetalle>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    sqlx::query_as::<_, CuentaContableDetalle>(
        "SELECT c.id, c.id_tipo_cuenta, c.id_cuenta_padre, c.codigo, c.cuenta, c.nivel, c.activo,
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
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: CrearCuenta,
) -> Result<CuentaContable, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos".to_string());
    }

    let nivel = calcular_nivel(&data.codigo)?;

    // Validar jerarquía si se proporcionó cuenta padre
    if let Some(ref padre_id) = data.id_cuenta_padre {
        let padre = sqlx::query_as::<_, CuentaContable>(
            "SELECT * FROM cuenta_contable WHERE id = ?"
        )
            .bind(padre_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| format!("Error: {}", e))?
            .ok_or_else(|| "Cuenta padre no encontrada".to_string())?;

        if padre.nivel >= nivel {
            return Err(format!(
                "La cuenta padre (nivel {}) debe tener un nivel menor que la cuenta hija (nivel {})",
                padre.nivel, nivel
            ));
        }
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO cuenta_contable (id, id_tipo_cuenta, id_cuenta_padre, codigo, cuenta, nivel, sync_status, sync_operation) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'create')"
    )
        .bind(&id)
        .bind(&data.id_tipo_cuenta)
        .bind(&data.id_cuenta_padre)
        .bind(&data.codigo)
        .bind(&data.cuenta)
        .bind(nivel)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando cuenta: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::post(&config, &auth_token, "cuentas", &serde_json::json!({
        "id": id,
        "id_tipo_cuenta": data.id_tipo_cuenta,
        "id_cuenta_padre": data.id_cuenta_padre,
        "codigo": data.codigo,
        "cuenta": data.cuenta,
    })).await;
    if synced {
        sqlx::query("UPDATE cuenta_contable SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, CuentaContable>("SELECT * FROM cuenta_contable WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}

#[tauri::command]
pub async fn editar_cuenta(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
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

    let new_codigo = data.codigo.clone().unwrap_or(current.codigo.clone());
    let new_nivel = calcular_nivel(&new_codigo)?;

    let new_padre = match data.id_cuenta_padre {
        Some(v) => v,
        None => current.id_cuenta_padre.clone(),
    };

    // Validar jerarquía si hay cuenta padre
    if let Some(ref padre_id) = new_padre {
        let padre = sqlx::query_as::<_, CuentaContable>(
            "SELECT * FROM cuenta_contable WHERE id = ?"
        )
            .bind(padre_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| format!("Error: {}", e))?
            .ok_or_else(|| "Cuenta padre no encontrada".to_string())?;

        if padre.nivel >= new_nivel {
            return Err(format!(
                "La cuenta padre (nivel {}) debe tener un nivel menor que la cuenta hija (nivel {})",
                padre.nivel, new_nivel
            ));
        }
    }

    let new_tipo_cuenta = data.id_tipo_cuenta.unwrap_or(current.id_tipo_cuenta.clone());
    let new_cuenta = data.cuenta.unwrap_or(current.cuenta);
    let new_activo = data.activo.unwrap_or(current.activo);

    sqlx::query(
        "UPDATE cuenta_contable SET id_tipo_cuenta = ?, id_cuenta_padre = ?, codigo = ?, cuenta = ?, nivel = ?, activo = ?, sync_status = 'pending', sync_operation = CASE WHEN sync_operation = 'create' THEN 'create' ELSE 'update' END WHERE id = ?"
    )
        .bind(&new_tipo_cuenta)
        .bind(&new_padre)
        .bind(&new_codigo)
        .bind(&new_cuenta)
        .bind(new_nivel)
        .bind(new_activo)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error actualizando cuenta: {}", e))?;

    // Forward to REST API — if it succeeds immediately mark as synced
    let synced = api_forward::put(&config, &auth_token, "cuentas", &id, &serde_json::json!({
        "id_tipo_cuenta": new_tipo_cuenta,
        "id_cuenta_padre": new_padre,
        "codigo": new_codigo,
        "cuenta": new_cuenta,
        "activo": new_activo,
    })).await;
    if synced {
        sqlx::query("UPDATE cuenta_contable SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
            .bind(&id).execute(pool.inner()).await.ok();
    }

    sqlx::query_as::<_, CuentaContable>("SELECT * FROM cuenta_contable WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))
}
