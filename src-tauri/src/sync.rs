use reqwest::Client;
use sqlx::SqlitePool;
use tauri::Manager;

use crate::models::*;

/// Run the initial sync when the app starts.
/// Pulls catalogs and certificaciones from the server.
pub async fn run_initial_sync(app: &tauri::AppHandle) -> Result<(), String> {
    let config = app.state::<ApiConfig>();
    let base_url = config.base_url.clone()
        .ok_or_else(|| "API URL not configured".to_string())?;
    let pool = app.state::<SqlitePool>();

    let client = Client::new();

    // Pull everything from server
    pull_from_server(pool.inner(), &client, &base_url).await?;

    // Push any pending local changes
    push_pending_internal(pool.inner(), &client, &base_url).await?;

    log::info!("Initial sync completed successfully");
    Ok(())
}

/// Push pending local changes before closing the app.
pub async fn push_pending(app: &tauri::AppHandle) -> Result<(), String> {
    let config = app.state::<ApiConfig>();
    let base_url = match config.base_url.clone() {
        Some(url) => url,
        None => return Ok(()), // No API configured, skip
    };
    let pool = app.state::<SqlitePool>();
    let client = Client::new();

    push_pending_internal(pool.inner(), &client, &base_url).await
}

/// Full sync: pull then push (called from sync_now command).
pub async fn full_sync(pool: &SqlitePool, api_url: &str) -> Result<SyncStatus, String> {
    let client = Client::new();

    // Pull from server
    pull_from_server(pool, &client, api_url).await?;

    // Push pending changes
    push_pending_internal(pool, &client, api_url).await?;

    // Return updated status
    get_sync_status_internal(pool, api_url).await
}

/// Get current sync status.
pub async fn get_sync_status_internal(pool: &SqlitePool, api_url: &str) -> Result<SyncStatus, String> {
    let last_sync = sqlx::query_as::<_, (String,)>(
        "SELECT value FROM sync_meta WHERE key = 'last_sync'"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Error: {}", e))?
    .map(|r| r.0);

    let pending: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM certificacion WHERE sync_status = 'pending'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Error: {}", e))?;

    let is_online = check_connectivity(api_url).await;

    Ok(SyncStatus {
        last_sync,
        pending_count: pending.0,
        is_online,
    })
}

// ============================================
// Internal functions
// ============================================

async fn check_connectivity(api_url: &str) -> bool {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build();
    match client {
        Ok(c) => c.get(format!("{}/api/health", api_url))
            .send()
            .await
            .is_ok(),
        Err(_) => false,
    }
}

/// Pull all data from the server (catalogs + certificaciones).
async fn pull_from_server(
    pool: &SqlitePool,
    client: &Client,
    api_url: &str,
) -> Result<(), String> {
    let last_sync = sqlx::query_as::<_, (String,)>(
        "SELECT value FROM sync_meta WHERE key = 'last_sync'"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Error reading last_sync: {}", e))?
    .map(|r| r.0);

    let mut url = format!("{}/api/sync/pull", api_url);
    if let Some(ref ls) = last_sync {
        url = format!("{}?last_sync={}", url, ls);
    }

    let resp = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Error connecting to server: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Server returned {}: {}", status, body));
    }

    let pull_data: SyncPullResponse = resp.json()
        .await
        .map_err(|e| format!("Error parsing pull response: {}", e))?;

    // Apply catalogs (full replace strategy)
    apply_catalogs(pool, &pull_data.catalogs).await?;

    // Apply certificaciones (upsert, skip locally modified)
    apply_certificaciones(pool, &pull_data.certificaciones).await?;
    apply_modificaciones(pool, &pull_data.modificaciones).await?;
    apply_observaciones(pool, &pull_data.observaciones).await?;

    // Update last_sync timestamp
    sqlx::query(
        "INSERT INTO sync_meta (key, value) VALUES ('last_sync', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&pull_data.server_time)
    .execute(pool)
    .await
    .map_err(|e| format!("Error updating last_sync: {}", e))?;

    log::info!("Pull completed. Server time: {}", pull_data.server_time);
    Ok(())
}

/// Apply catalog data from server (overwrite local read-only caches).
async fn apply_catalogs(pool: &SqlitePool, catalogs: &SyncCatalogs) -> Result<(), String> {
    // Dependencias
    for d in &catalogs.dependencias {
        sqlx::query(
            "INSERT INTO dependencia (id, codigo, dependencia, activo) VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET codigo = excluded.codigo, dependencia = excluded.dependencia, activo = excluded.activo"
        )
        .bind(&d.id).bind(&d.codigo).bind(&d.dependencia).bind(d.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing dependencia: {}", e))?;
    }

    // Tipo cuentas
    for tc in &catalogs.tipo_cuentas {
        sqlx::query(
            "INSERT INTO tipo_cuenta (id, tipo, activo) VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET tipo = excluded.tipo, activo = excluded.activo"
        )
        .bind(&tc.id).bind(&tc.tipo).bind(tc.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing tipo_cuenta: {}", e))?;
    }

    // Unidades
    for u in &catalogs.unidades {
        sqlx::query(
            "INSERT INTO unidad_organizacional (id, id_dependencia, codigo, unidad, activo) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET id_dependencia = excluded.id_dependencia, codigo = excluded.codigo, unidad = excluded.unidad, activo = excluded.activo"
        )
        .bind(&u.id).bind(&u.id_dependencia).bind(u.codigo).bind(&u.unidad).bind(u.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing unidad: {}", e))?;
    }

    // Cuentas contables
    for cc in &catalogs.cuentas_contables {
        sqlx::query(
            "INSERT INTO cuenta_contable (id, id_tipo_cuenta, id_cuenta_padre, codigo, cuenta, nivel, activo) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET id_tipo_cuenta = excluded.id_tipo_cuenta, id_cuenta_padre = excluded.id_cuenta_padre, codigo = excluded.codigo, cuenta = excluded.cuenta, nivel = excluded.nivel, activo = excluded.activo"
        )
        .bind(&cc.id).bind(&cc.id_tipo_cuenta).bind(&cc.id_cuenta_padre).bind(&cc.codigo).bind(&cc.cuenta).bind(cc.nivel).bind(cc.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing cuenta_contable: {}", e))?;
    }

    // Proyectos
    for p in &catalogs.proyectos {
        sqlx::query(
            "INSERT INTO proyecto (id, nombre, descripcion, pei, activo) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, descripcion = excluded.descripcion, pei = excluded.pei, activo = excluded.activo"
        )
        .bind(&p.id).bind(&p.nombre).bind(&p.descripcion).bind(&p.pei).bind(p.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing proyecto: {}", e))?;
    }

    // Usuarios
    for u in &catalogs.usuarios {
        sqlx::query(
            "INSERT INTO usuario (id, usuario, password, activo) VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET usuario = excluded.usuario, password = excluded.password, activo = excluded.activo"
        )
        .bind(&u.id).bind(&u.usuario).bind(&u.password).bind(u.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing usuario: {}", e))?;
    }

    // Perfiles
    for p in &catalogs.perfiles {
        sqlx::query(
            "INSERT INTO perfil (id, id_usuario, nombre_completo, cargo, rol) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET nombre_completo = excluded.nombre_completo, cargo = excluded.cargo, rol = excluded.rol"
        )
        .bind(&p.id).bind(&p.id_usuario).bind(&p.nombre_completo).bind(&p.cargo).bind(&p.rol)
        .execute(pool).await.map_err(|e| format!("Error syncing perfil: {}", e))?;
    }

    Ok(())
}

/// Apply certificaciones from server pull. Skip rows that have local pending changes.
async fn apply_certificaciones(
    pool: &SqlitePool,
    rows: &[SyncCertificacionRow],
) -> Result<(), String> {
    for row in rows {
        // Check if this certificacion has pending local changes
        let local: Option<(String,)> = sqlx::query_as(
            "SELECT sync_status FROM certificacion WHERE id = ?"
        )
        .bind(&row.id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Error: {}", e))?;

        if let Some((status,)) = &local {
            if status == "pending" {
                // Local has unsaved changes — mark as conflict if server also changed
                log::warn!("Conflict detected for certificacion {}, keeping local version", row.id);
                let conflict_json = serde_json::to_string(row).unwrap_or_default();
                sqlx::query(
                    "UPDATE certificacion SET sync_status = 'conflict', conflict_data = ?, server_updated_at = ? WHERE id = ?"
                )
                .bind(&conflict_json)
                .bind(&row.updated_at)
                .bind(&row.id)
                .execute(pool).await.map_err(|e| format!("Error: {}", e))?;
                continue;
            }
        }

        // Upsert the server version
        sqlx::query(
            "INSERT INTO certificacion (id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario, created_at, updated_at, deleted_at, sync_status, server_updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
             ON CONFLICT(id) DO UPDATE SET
                id_unidad = excluded.id_unidad,
                id_cuenta_contable = excluded.id_cuenta_contable,
                id_proyecto = excluded.id_proyecto,
                generado_por = excluded.generado_por,
                concepto = excluded.concepto,
                nro_certificacion = excluded.nro_certificacion,
                anio_certificacion = excluded.anio_certificacion,
                fecha_certificacion = excluded.fecha_certificacion,
                monto_total = excluded.monto_total,
                comentario = excluded.comentario,
                updated_at = excluded.updated_at,
                deleted_at = excluded.deleted_at,
                sync_status = 'synced',
                server_updated_at = excluded.server_updated_at,
                conflict_data = NULL"
        )
        .bind(&row.id)
        .bind(&row.id_unidad)
        .bind(&row.id_cuenta_contable)
        .bind(&row.id_proyecto)
        .bind(&row.generado_por)
        .bind(&row.concepto)
        .bind(row.nro_certificacion)
        .bind(row.anio_certificacion)
        .bind(&row.fecha_certificacion)
        .bind(&row.monto_total)
        .bind(&row.comentario)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .bind(&row.deleted_at)
        .bind(&row.updated_at)
        .execute(pool)
        .await
        .map_err(|e| format!("Error upserting certificacion: {}", e))?;
    }
    Ok(())
}

/// Apply modificaciones from server pull.
async fn apply_modificaciones(
    pool: &SqlitePool,
    rows: &[SyncModificacionRow],
) -> Result<(), String> {
    for row in rows {
        sqlx::query(
            "INSERT INTO modificacion (id, id_certificacion, modificado_por, monto_antiguo, monto_nuevo, concepto_antiguo, concepto_nuevo, fecha_hora, comentario, created_at, updated_at, deleted_at, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                monto_antiguo = excluded.monto_antiguo,
                monto_nuevo = excluded.monto_nuevo,
                concepto_antiguo = excluded.concepto_antiguo,
                concepto_nuevo = excluded.concepto_nuevo,
                comentario = excluded.comentario,
                updated_at = excluded.updated_at,
                deleted_at = excluded.deleted_at,
                sync_status = 'synced'"
        )
        .bind(&row.id)
        .bind(&row.id_certificacion)
        .bind(&row.modificado_por)
        .bind(&row.monto_antiguo)
        .bind(&row.monto_nuevo)
        .bind(&row.concepto_antiguo)
        .bind(&row.concepto_nuevo)
        .bind(&row.fecha_hora)
        .bind(&row.comentario)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .bind(&row.deleted_at)
        .execute(pool)
        .await
        .map_err(|e| format!("Error upserting modificacion: {}", e))?;
    }
    Ok(())
}

/// Apply observaciones from server pull.
async fn apply_observaciones(
    pool: &SqlitePool,
    rows: &[SyncObservacionRow],
) -> Result<(), String> {
    for row in rows {
        sqlx::query(
            "INSERT INTO observacion_certificacion (id, id_certificacion, creado_por, comentario, created_at, sync_status)
             VALUES (?, ?, ?, ?, ?, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                comentario = excluded.comentario,
                sync_status = 'synced'"
        )
        .bind(&row.id)
        .bind(&row.id_certificacion)
        .bind(&row.creado_por)
        .bind(&row.comentario)
        .bind(&row.created_at)
        .execute(pool)
        .await
        .map_err(|e| format!("Error upserting observacion: {}", e))?;
    }
    Ok(())
}

/// Push all locally pending changes to the server.
async fn push_pending_internal(
    pool: &SqlitePool,
    client: &Client,
    api_url: &str,
) -> Result<(), String> {
    // Gather pending certificaciones
    let cert_rows: Vec<(String, String, String, Option<String>, String, String, i32, i32, String, String, Option<String>, String, String, Option<String>)> =
        sqlx::query_as(
            "SELECT id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario, created_at, updated_at, deleted_at
             FROM certificacion WHERE sync_status = 'pending'"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Error fetching pending certificaciones: {}", e))?;

    let certificaciones: Vec<SyncCertificacionRow> = cert_rows.into_iter().map(|r| SyncCertificacionRow {
        id: r.0, id_unidad: r.1, id_cuenta_contable: r.2, id_proyecto: r.3,
        generado_por: r.4, concepto: r.5, nro_certificacion: r.6,
        anio_certificacion: r.7, fecha_certificacion: r.8, monto_total: r.9,
        comentario: r.10, created_at: r.11, updated_at: r.12, deleted_at: r.13,
    }).collect();

    // Gather pending modificaciones
    let mod_rows: Vec<(String, String, String, Option<String>, Option<String>, Option<String>, Option<String>, String, Option<String>, String, String, Option<String>)> =
        sqlx::query_as(
            "SELECT id, id_certificacion, modificado_por, monto_antiguo, monto_nuevo, concepto_antiguo, concepto_nuevo, fecha_hora, comentario, created_at, updated_at, deleted_at
             FROM modificacion WHERE sync_status = 'pending'"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Error fetching pending modificaciones: {}", e))?;

    let modificaciones: Vec<SyncModificacionRow> = mod_rows.into_iter().map(|r| SyncModificacionRow {
        id: r.0, id_certificacion: r.1, modificado_por: r.2, monto_antiguo: r.3,
        monto_nuevo: r.4, concepto_antiguo: r.5, concepto_nuevo: r.6,
        fecha_hora: r.7, comentario: r.8, created_at: r.9, updated_at: r.10, deleted_at: r.11,
    }).collect();

    // Gather pending observaciones
    let obs_rows: Vec<(String, String, String, String, String)> =
        sqlx::query_as(
            "SELECT id, id_certificacion, creado_por, comentario, created_at
             FROM observacion_certificacion WHERE sync_status = 'pending'"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Error fetching pending observaciones: {}", e))?;

    let observaciones: Vec<SyncObservacionRow> = obs_rows.into_iter().map(|r| SyncObservacionRow {
        id: r.0, id_certificacion: r.1, creado_por: r.2, comentario: r.3, created_at: r.4,
    }).collect();

    let total = certificaciones.len() + modificaciones.len() + observaciones.len();
    if total == 0 {
        log::info!("No pending changes to push");
        return Ok(());
    }

    let payload = SyncPushPayload {
        certificaciones,
        modificaciones,
        observaciones,
    };

    let resp = client.post(&format!("{}/api/sync/push", api_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error pushing to server: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Server push returned {}: {}", status, body));
    }

    let push_resp: SyncPushResponse = resp.json()
        .await
        .map_err(|e| format!("Error parsing push response: {}", e))?;

    // Mark accepted items as synced
    for id in &push_resp.accepted {
        // Try each table — the id could be in any of them
        sqlx::query("UPDATE certificacion SET sync_status = 'synced', conflict_data = NULL WHERE id = ? AND sync_status = 'pending'")
            .bind(id).execute(pool).await.ok();
        sqlx::query("UPDATE modificacion SET sync_status = 'synced' WHERE id = ? AND sync_status = 'pending'")
            .bind(id).execute(pool).await.ok();
        sqlx::query("UPDATE observacion_certificacion SET sync_status = 'synced' WHERE id = ? AND sync_status = 'pending'")
            .bind(id).execute(pool).await.ok();
    }

    // Mark conflicts
    for conflict in &push_resp.conflicts {
        let conflict_json = serde_json::to_string(&conflict.server_version).unwrap_or_default();
        match conflict.table_name.as_str() {
            "certificacion" => {
                sqlx::query("UPDATE certificacion SET sync_status = 'conflict', conflict_data = ? WHERE id = ?")
                    .bind(&conflict_json).bind(&conflict.id)
                    .execute(pool).await.ok();
            }
            "modificacion" => {
                sqlx::query("UPDATE modificacion SET sync_status = 'conflict' WHERE id = ?")
                    .bind(&conflict.id)
                    .execute(pool).await.ok();
            }
            _ => {}
        }
    }

    log::info!("Push completed. {} accepted, {} conflicts", push_resp.accepted.len(), push_resp.conflicts.len());
    Ok(())
}
