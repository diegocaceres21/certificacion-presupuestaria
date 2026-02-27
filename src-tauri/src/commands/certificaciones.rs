use chrono::Utc;
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
            uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
            cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
            p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
            c.generado_por as generado_por_id,
            pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
            c.created_at, c.updated_at
        FROM certificacion c
        INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
        INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
        LEFT JOIN proyecto p ON c.id_proyecto = p.id
        INNER JOIN usuario u ON c.generado_por = u.id
        INNER JOIN perfil pf ON pf.id_usuario = u.id
        WHERE c.deleted_at IS NULL"
    );

    let mut params: Vec<String> = Vec::new();

    if let Some(ref id_unidad) = filtros.id_unidad {
        query.push_str(" AND c.id_unidad = ?");
        params.push(id_unidad.clone());
    }
    if let Some(ref id_cuenta) = filtros.id_cuenta_contable {
        query.push_str(" AND c.id_cuenta_contable = ?");
        params.push(id_cuenta.clone());
    }
    if let Some(ref id_proyecto) = filtros.id_proyecto {
        query.push_str(" AND c.id_proyecto = ?");
        params.push(id_proyecto.clone());
    }
    if let Some(ref generado_por) = filtros.generado_por {
        query.push_str(" AND c.generado_por = ?");
        params.push(generado_por.clone());
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

    let result = sqlx::query_as::<_, CertificacionDetalle>(
        "SELECT
            c.id, c.nro_certificacion, c.anio_certificacion,
            DATE(c.fecha_certificacion) as fecha_certificacion, c.concepto, c.monto_total, c.comentario,
            uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
            cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
            p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
            c.generado_por as generado_por_id,
            pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
            c.created_at, c.updated_at
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
    .map_err(|e| format!("Error obteniendo certificación: {}", e))?;

    result.ok_or_else(|| "Certificación no encontrada".to_string())
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

    // Create modification record
    let mod_id = Uuid::new_v4().to_string();
    let monto_antiguo = if data.monto_total.is_some() { Some(current.monto_total.clone()) } else { None };
    let concepto_antiguo = if data.concepto.is_some() { Some(current.concepto.clone()) } else { None };

    sqlx::query(
        "INSERT INTO modificacion (id, id_certificacion, modificado_por, monto_antiguo, monto_nuevo, concepto_antiguo, concepto_nuevo, fecha_hora, comentario, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'pending')"
    )
    .bind(&mod_id)
    .bind(&id)
    .bind(&claims.sub)
    .bind(&monto_antiguo)
    .bind(&data.monto_total)
    .bind(&concepto_antiguo)
    .bind(&data.concepto)
    .bind(&data.comentario)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando registro de modificación: {}", e))?;

    // Update certification fields
    let new_concepto = data.concepto.unwrap_or(current.concepto);
    let new_monto = data.monto_total.unwrap_or(current.monto_total);
    let new_unidad = data.id_unidad.unwrap_or(current.id_unidad);
    let new_cuenta = data.id_cuenta_contable.unwrap_or(current.id_cuenta_contable);
    let new_proyecto = data.id_proyecto.or(current.id_proyecto);
    let new_comentario = data.comentario.or(current.comentario);

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
    sqlx::query_as::<_, CertificacionDetalle>(
        "SELECT
            c.id, c.nro_certificacion, c.anio_certificacion,
            DATE(c.fecha_certificacion) as fecha_certificacion, c.concepto, c.monto_total, c.comentario,
            uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
            cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
            p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
            c.generado_por as generado_por_id,
            pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
            c.created_at, c.updated_at
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
    .ok_or_else(|| "Certificación no encontrada".to_string())
}
