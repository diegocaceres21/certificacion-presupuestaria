use chrono::Utc;
use std::collections::{HashMap, HashSet};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::auth;
use crate::models::*;
use crate::sync;

#[tauri::command]
pub async fn listar_certificaciones(
    pool: State<'_, SqlitePool>,
    token: String,
    filtros: Option<FiltrosCertificacion>,
) -> Result<Vec<CertificacionDetalle>, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    let filtros = filtros.unwrap_or_default();

    let mut query = String::from(
        "SELECT
            c.id, c.nro_certificacion, c.anio_certificacion,
            DATE(c.fecha_certificacion) as fecha_certificacion, c.concepto, c.monto_total, c.comentario,
            COALESCE((SELECT COUNT(*) FROM certificacion_cuenta_detalle d WHERE d.id_certificacion = c.id), 1) as detalle_count,
            uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
            cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
            p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
            c.generado_por as generado_por_id,
            pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
            c.created_at, c.updated_at, c.deleted_at
        FROM certificacion c
        INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
        INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
        LEFT JOIN proyecto p ON c.id_proyecto = p.id
        INNER JOIN usuario u ON c.generado_por = u.id
        INNER JOIN perfil pf ON pf.id_usuario = u.id
        WHERE "
    );

    // Base filter: anuladas or vigentes
    if filtros.mostrar_anuladas == Some(true) {
        query.push_str("c.deleted_at IS NOT NULL");
    } else {
        query.push_str("c.deleted_at IS NULL");
    }

    let mut params: Vec<String> = Vec::new();

    // Helper: appends an IN clause for a vec of ids
    fn push_in(query: &mut String, params: &mut Vec<String>, col: &str, ids: &[String]) {
        if ids.is_empty() { return; }
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        query.push_str(&format!(" AND {} IN ({})", col, placeholders));
        params.extend_from_slice(ids);
    }

    fn push_exists_in(query: &mut String, params: &mut Vec<String>, ids: &[String]) {
        if ids.is_empty() { return; }
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        query.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM certificacion_cuenta_detalle d WHERE d.id_certificacion = c.id AND d.id_cuenta_contable IN ({}))",
            placeholders
        ));
        params.extend_from_slice(ids);
    }

    if let Some(ref ids) = filtros.id_unidad {
        push_in(&mut query, &mut params, "c.id_unidad", ids);
    }
    if let Some(ref ids) = filtros.id_cuenta_contable {
        push_exists_in(&mut query, &mut params, ids);
    }
    if let Some(ref ids) = filtros.id_proyecto {
        push_in(&mut query, &mut params, "c.id_proyecto", ids);
    }
    if let Some(ref ids) = filtros.generado_por {
        push_in(&mut query, &mut params, "c.generado_por", ids);
    }
    if let Some(ref fecha_desde) = filtros.fecha_desde {
        query.push_str(" AND c.fecha_certificacion >= ?");
        params.push(fecha_desde.clone());
    }
    if let Some(ref fecha_hasta) = filtros.fecha_hasta {
        query.push_str(" AND c.fecha_certificacion <= ?");
        params.push(fecha_hasta.clone());
    }
    if let Some(ref busqueda) = filtros.busqueda {
        query.push_str(" AND (c.concepto LIKE ? OR CAST(c.nro_certificacion AS TEXT) LIKE ?)");
        let like_param = format!("%{}%", busqueda);
        params.push(like_param.clone());
        params.push(like_param);
    }

    query.push_str(" ORDER BY c.anio_certificacion DESC, c.nro_certificacion DESC");

    let mut q = sqlx::query_as::<_, CertificacionDetalle>(&query);
    for param in &params {
        q = q.bind(param);
    }

    let results = q.fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Error listando certificaciones: {}", e))?;

    Ok(results)
}

#[tauri::command]
pub async fn obtener_certificacion(
    pool: State<'_, SqlitePool>,
    token: String,
    id: String,
) -> Result<CertificacionDetalle, String> {

    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    let mut result = sqlx::query_as::<_, CertificacionDetalle>(
    "SELECT
        c.id, c.nro_certificacion, c.anio_certificacion,
        DATE(c.fecha_certificacion) as fecha_certificacion, c.concepto, c.monto_total, c.comentario,
        COALESCE((SELECT COUNT(*) FROM certificacion_cuenta_detalle d WHERE d.id_certificacion = c.id), 1) as detalle_count,
        uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
        cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
        p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
        c.generado_por as generado_por_id,
        pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
        c.created_at, c.updated_at, c.deleted_at
    FROM certificacion c
    INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
    INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
    LEFT JOIN proyecto p ON c.id_proyecto = p.id
    INNER JOIN usuario u ON c.generado_por = u.id
    INNER JOIN perfil pf ON pf.id_usuario = u.id
        WHERE c.id = ? AND c.deleted_at IS NULL"
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Error obteniendo certificación: {}", e))?
    .ok_or_else(|| "Certificación no encontrada".to_string())?;

    let detalles = sqlx::query_as::<_, CertificacionCuentaDetalle>(
    "SELECT d.id_cuenta_contable,
            cc.codigo as cuenta_codigo,
            cc.cuenta as cuenta_nombre,
            d.monto
     FROM certificacion_cuenta_detalle d
     INNER JOIN cuenta_contable cc ON d.id_cuenta_contable = cc.id
     WHERE d.id_certificacion = ?
     ORDER BY cc.codigo"
    )
    .bind(&id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Error obteniendo detalles de certificación: {}", e))?;

    result.detalles = detalles;

    Ok(result)
}

#[tauri::command]
pub async fn crear_certificacion(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    data: CrearCertificacion,
) -> Result<CertificacionDetalle, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos para crear certificaciones".to_string());
    }

    let anio_actual = Utc::now().format("%Y").to_string().parse::<i32>().unwrap();

    // Get next certification number for current year
    let max_nro = sqlx::query_as::<_, (Option<i32>,)>(
        "SELECT MAX(nro_certificacion) FROM certificacion WHERE anio_certificacion = ? AND deleted_at IS NULL"
    )
    .bind(anio_actual)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?;

    let nro = max_nro.0.unwrap_or(0) + 1;
    let id = Uuid::new_v4().to_string();
    let fecha = Utc::now().naive_utc().date();

    let detalles = resolve_certificacion_detalles(
        pool.inner(),
        &data.id_cuenta_contable,
        data.detalles.clone(),
        &data.monto_total,
    ).await?;

    sqlx::query(
        "INSERT INTO certificacion (id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario, sync_status, local_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))"
    )
    .bind(&id)
    .bind(&data.id_unidad)
    .bind(&data.id_cuenta_contable)
    .bind(&data.id_proyecto)
    .bind(&claims.sub)
    .bind(&data.concepto)
    .bind(nro)
    .bind(anio_actual)
    .bind(fecha)
    .bind(&data.monto_total)
    .bind(&data.comentario)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando certificación: {}", e))?;

    insert_certificacion_detalles(pool.inner(), &id, &detalles).await?;

    // If there's a comment, create an observation entry
    if let Some(ref comentario) = data.comentario {
        if !comentario.trim().is_empty() {
            let obs_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO observacion_certificacion (id, id_certificacion, creado_por, comentario, sync_status) VALUES (?, ?, ?, ?, 'pending')"
            )
            .bind(&obs_id)
            .bind(&id)
            .bind(&claims.sub)
            .bind(comentario)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Error creando observación: {}", e))?;
        }
    }

    // Attempt immediate push while online (best-effort)
    sync::try_push(config.inner(), auth_token.inner(), pool.inner()).await;

    obtener_certificacion_internal(pool.inner(), &id).await
}

#[tauri::command]
pub async fn editar_certificacion(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
    data: EditarCertificacion,
) -> Result<CertificacionDetalle, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol == "lector" {
        return Err("No tiene permisos para editar certificaciones".to_string());
    }

    // Get current certification
    let current = sqlx::query_as::<_, Certificacion>(
        "SELECT id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, DATE(fecha_certificacion) as fecha_certificacion, monto_total, comentario, created_at, updated_at, deleted_at FROM certificacion WHERE id = ? AND deleted_at IS NULL"
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?
    .ok_or_else(|| "Certificación no encontrada".to_string())?;

    // Only the creator or admin can edit
    if current.generado_por != claims.sub && claims.rol != "administrador" {
        return Err("Solo el creador o un administrador puede editar esta certificación".to_string());
    }

    // Update certification fields
    let new_concepto = data.concepto.unwrap_or(current.concepto);
    let new_monto = data.monto_total.unwrap_or(current.monto_total);
    let new_unidad = data.id_unidad.unwrap_or(current.id_unidad);
    let new_cuenta = data.id_cuenta_contable.unwrap_or(current.id_cuenta_contable);
    let new_proyecto = data.id_proyecto.or(current.id_proyecto);
    let new_comentario = data.comentario.or(current.comentario);

    let detalles = resolve_certificacion_detalles(
        pool.inner(),
        &new_cuenta,
        data.detalles.clone(),
        &new_monto,
    ).await?;

    sqlx::query(
        "UPDATE certificacion SET id_unidad = ?, id_cuenta_contable = ?, id_proyecto = ?, concepto = ?, monto_total = ?, comentario = ?, updated_at = datetime('now'), sync_status = 'pending', local_updated_at = datetime('now') WHERE id = ?"
    )
    .bind(&new_unidad)
    .bind(&new_cuenta)
    .bind(&new_proyecto)
    .bind(&new_concepto)
    .bind(&new_monto)
    .bind(&new_comentario)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando certificación: {}", e))?;

    replace_certificacion_detalles(pool.inner(), &id, &detalles).await?;

    // Attempt immediate push while online (best-effort)
    sync::try_push(config.inner(), auth_token.inner(), pool.inner()).await;

    obtener_certificacion_internal(pool.inner(), &id).await
}

#[tauri::command]
pub async fn eliminar_certificacion(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
) -> Result<String, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    if claims.rol != "administrador" {
        return Err("Solo un administrador puede eliminar certificaciones".to_string());
    }

    sqlx::query("UPDATE certificacion SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_status = 'pending', local_updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error: {}", e))?;

    // Attempt immediate push while online (best-effort)
    sync::try_push(config.inner(), auth_token.inner(), pool.inner()).await;

    Ok("Certificación eliminada correctamente".to_string())
}

async fn obtener_certificacion_internal(
    pool: &SqlitePool,
    id: &str,
) -> Result<CertificacionDetalle, String> {
    let mut cert = sqlx::query_as::<_, CertificacionDetalle>(
        "SELECT
            c.id, c.nro_certificacion, c.anio_certificacion,
            DATE(c.fecha_certificacion) as fecha_certificacion, c.concepto, c.monto_total, c.comentario,
            COALESCE((SELECT COUNT(*) FROM certificacion_cuenta_detalle d WHERE d.id_certificacion = c.id), 1) as detalle_count,
            uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
            cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
            p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
            c.generado_por as generado_por_id,
            pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
            c.created_at, c.updated_at, c.deleted_at
        FROM certificacion c
        INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
        INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
        LEFT JOIN proyecto p ON c.id_proyecto = p.id
        INNER JOIN usuario u ON c.generado_por = u.id
        INNER JOIN perfil pf ON pf.id_usuario = u.id
        WHERE c.id = ? AND c.deleted_at IS NULL"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Error: {}", e))?
    .ok_or_else(|| "Certificación no encontrada".to_string())?;

    let detalles = sqlx::query_as::<_, CertificacionCuentaDetalle>(
        "SELECT d.id_cuenta_contable,
                cc.codigo as cuenta_codigo,
                cc.cuenta as cuenta_nombre,
                d.monto
         FROM certificacion_cuenta_detalle d
         INNER JOIN cuenta_contable cc ON d.id_cuenta_contable = cc.id
         WHERE d.id_certificacion = ?
         ORDER BY cc.codigo"
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Error obteniendo detalles de certificación: {}", e))?;

    println!("Detalles: {:?}", detalles);
    cert.detalles = detalles;
    Ok(cert)
}

async fn resolve_certificacion_detalles(
    pool: &SqlitePool,
    base_cuenta_id: &str,
    detalles: Option<Vec<CertificacionCuentaDetalleInput>>,
    monto_total: &str,
) -> Result<Vec<CertificacionCuentaDetalleInput>, String> {
    let mut resolved = detalles.unwrap_or_default();
    if resolved.is_empty() {
        resolved.push(CertificacionCuentaDetalleInput {
            id_cuenta_contable: base_cuenta_id.to_string(),
            monto: monto_total.to_string(),
        });
    }

    let mut ids: Vec<String> = resolved.iter().map(|d| d.id_cuenta_contable.clone()).collect();
    if !ids.iter().any(|id| id == base_cuenta_id) {
        return Err("La cuenta principal debe estar incluida en el detalle".to_string());
    }
    ids.sort();
    ids.dedup();

    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let query = format!(
        "SELECT id, codigo, nivel FROM cuenta_contable WHERE id IN ({})",
        placeholders
    );
    let mut q = sqlx::query_as::<_, (String, String, i32)>(&query);
    for id in &ids {
        q = q.bind(id);
    }
    let rows = q
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Error obteniendo cuentas: {}", e))?;

    let mut cuentas: HashMap<String, (String, i32)> = HashMap::new();
    for (id, codigo, nivel) in rows {
        cuentas.insert(id, (codigo, nivel));
    }

    let (base_codigo, base_nivel) = cuentas
        .get(base_cuenta_id)
        .ok_or_else(|| "Cuenta principal no encontrada".to_string())?
        .clone();

    let base_es_511 = base_codigo.starts_with("511") && base_nivel == 5;
    if !base_es_511 {
        if resolved.len() != 1 || resolved[0].id_cuenta_contable != base_cuenta_id {
            return Err("Solo se permite una cuenta cuando la cuenta principal no es 511".to_string());
        }
    }

    let suffix = codigo_suffix(&base_codigo);
    let mut seen = HashSet::new();
    let mut suma = 0.0f64;
    for det in &resolved {
        if !seen.insert(det.id_cuenta_contable.clone()) {
            return Err("No puede repetir la misma cuenta en el detalle".to_string());
        }
        let (codigo, nivel) = cuentas
            .get(&det.id_cuenta_contable)
            .ok_or_else(|| "Cuenta del detalle no encontrada".to_string())?
            .clone();
        if base_es_511 {
            if nivel != 5 || !codigo.starts_with("511") || codigo_suffix(&codigo) != suffix {
                return Err("Las cuentas del detalle deben ser nivel 5, comenzar con 511 y tener la misma terminación".to_string());
            }
        }
        let monto = parse_monto(&det.monto)?;
        if monto <= 0.0 {
            return Err("El monto por cuenta debe ser mayor a 0".to_string());
        }
        suma += monto;
    }

    let total = parse_monto(monto_total)?;
    if (suma - total).abs() > 0.01 {
        return Err("La suma del detalle debe coincidir con el monto total".to_string());
    }

    Ok(resolved)
}

async fn insert_certificacion_detalles(
    pool: &SqlitePool,
    cert_id: &str,
    detalles: &[CertificacionCuentaDetalleInput],
) -> Result<(), String> {
    for det in detalles {
        let det_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO certificacion_cuenta_detalle (id, id_certificacion, id_cuenta_contable, monto)
             VALUES (?, ?, ?, ?)"
        )
        .bind(&det_id)
        .bind(cert_id)
        .bind(&det.id_cuenta_contable)
        .bind(&det.monto)
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando detalle de certificación: {}", e))?;
    }
    Ok(())
}

async fn replace_certificacion_detalles(
    pool: &SqlitePool,
    cert_id: &str,
    detalles: &[CertificacionCuentaDetalleInput],
) -> Result<(), String> {
    sqlx::query("DELETE FROM certificacion_cuenta_detalle WHERE id_certificacion = ?")
        .bind(cert_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Error limpiando detalles: {}", e))?;
    insert_certificacion_detalles(pool, cert_id, detalles).await
}

fn codigo_suffix(codigo: &str) -> String {
    let len = codigo.len();
    if len <= 3 {
        codigo.to_string()
    } else {
        codigo[len - 3..].to_string()
    }
}

fn parse_monto(value: &str) -> Result<f64, String> {
    value
        .replace(',', ".")
        .parse::<f64>()
        .map_err(|_| "Monto inválido".to_string())
}

#[tauri::command]
pub async fn anular_certificacion(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
) -> Result<String, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    // Obtain the creator of the certificacion to validate permissions
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT generado_por FROM certificacion WHERE id = ? AND deleted_at IS NULL"
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?;

    let (generado_por,) = row.ok_or_else(|| "Certificación no encontrada o ya anulada".to_string())?;

    if claims.rol != "administrador" && claims.sub != generado_por {
        return Err("No tiene permisos para anular esta certificación".to_string());
    }

    sqlx::query(
        "UPDATE certificacion SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_status = 'pending', local_updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
    )
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error anulando certificación: {}", e))?;

    // Attempt immediate push while online (best-effort)
    sync::try_push(config.inner(), auth_token.inner(), pool.inner()).await;

    Ok("Certificación anulada correctamente".to_string())
}

#[tauri::command]
pub async fn reactivar_certificacion(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
    auth_token: State<'_, AuthToken>,
    token: String,
    id: String,
) -> Result<String, String> {
    let claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    // Obtain the creator of the certificacion to validate permissions
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT generado_por FROM certificacion WHERE id = ? AND deleted_at IS NOT NULL"
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Error: {}", e))?;

    let (generado_por,) = row.ok_or_else(|| "Certificación no encontrada o no está anulada".to_string())?;

    if claims.rol != "administrador" && claims.sub != generado_por {
        return Err("No tiene permisos para reactivar esta certificación".to_string());
    }

    sqlx::query(
        "UPDATE certificacion SET deleted_at = NULL, updated_at = datetime('now'), sync_status = 'pending', local_updated_at = datetime('now') WHERE id = ? AND deleted_at IS NOT NULL"
    )
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error reactivando certificación: {}", e))?;

    // Attempt immediate push while online (best-effort)
    sync::try_push(config.inner(), auth_token.inner(), pool.inner()).await;

    Ok("Certificación reactivada correctamente".to_string())
}
