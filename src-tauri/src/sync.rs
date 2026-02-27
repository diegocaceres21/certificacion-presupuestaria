use reqwest::Client;
use sqlx::SqlitePool;
use tauri::Manager;

use crate::models::*;

/// Run the initial sync when the app starts.
/// Pulls catalogs and certificaciones from the server.
/// Currently unused — sync is deferred until after login.
#[allow(dead_code)]
pub async fn run_initial_sync(app: &tauri::AppHandle) -> Result<(), String> {
    let config = app.state::<ApiConfig>();
    let base_url = config.base_url.clone()
        .ok_or_else(|| "API URL not configured".to_string())?;
    let pool = app.state::<SqlitePool>();

    // Read the stored auth token
    let auth_state = app.state::<AuthToken>();
    let token = auth_state.token.lock()
        .map_err(|e| format!("Lock error: {}", e))?
        .clone()
        .ok_or_else(|| "No auth token available (user has not logged in yet)".to_string())?;

    let client = Client::new();

    // Pull everything from server
    pull_from_server(pool.inner(), &client, &base_url, &token).await?;

    // Push any pending local changes
    push_pending_internal(pool.inner(), &client, &base_url, &token).await?;

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

    // Read the stored auth token
    let auth_state = app.state::<AuthToken>();
    let token = match auth_state.token.lock().ok().and_then(|g| g.clone()) {
        Some(t) => t,
        None => return Ok(()), // No token, skip sync
    };

    push_pending_internal(pool.inner(), &client, &base_url, &token).await
}

/// Full sync: push first, then pull (called from sync_now command).
///
/// Pushing first ensures locally-pending records are sent to the server
/// *before* the pull runs, so `apply_*` functions never see them as
/// conflicts and overwrite them with the stale server version.
pub async fn full_sync(pool: &SqlitePool, api_url: &str, token: &str) -> Result<SyncStatus, String> {
    let client = Client::new();

    // 1. Push local pending changes FIRST — prevents accidental conflict
    //    marking in the subsequent pull.
    push_pending_internal(pool, &client, api_url, token).await?;

    // 2. Pull latest canonical state from server
    pull_from_server(pool, &client, api_url, token).await?;

    // Return updated status
    get_sync_status_internal(pool, api_url).await
}

/// Full sync triggered immediately after a successful REST API login.
///
/// Push runs first so that any records created while the user was offline
/// (before this login session) reach the server before we overwrite local
/// SQLite with the server's canonical state. On a first-run device there
/// will be 0 pending records, so the push is a no-op.
pub async fn pull_after_login(pool: &SqlitePool, api_url: &str, token: &str) -> Result<(), String> {
    let client = Client::new();
    // 1. Upload any locally-pending changes FIRST
    push_pending_internal(pool, &client, api_url, token).await?;
    // 2. Replicate server state into SQLite
    pull_from_server(pool, &client, api_url, token).await
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
        "SELECT
            (SELECT COUNT(*) FROM certificacion WHERE sync_status = 'pending') +
            (SELECT COUNT(*) FROM modificacion WHERE sync_status = 'pending') +
            (SELECT COUNT(*) FROM observacion_certificacion WHERE sync_status = 'pending') +
            (SELECT COUNT(*) FROM proyecto WHERE sync_status = 'pending') +
            (SELECT COUNT(*) FROM dependencia WHERE sync_status = 'pending') +
            (SELECT COUNT(*) FROM unidad_organizacional WHERE sync_status = 'pending') +
            (SELECT COUNT(*) FROM tipo_cuenta WHERE sync_status = 'pending') +
            (SELECT COUNT(*) FROM cuenta_contable WHERE sync_status = 'pending')"
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
    token: &str,
) -> Result<(), String> {
    let last_sync = sqlx::query_as::<_, (String,)>(
        "SELECT value FROM sync_meta WHERE key = 'last_sync'"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Error reading last_sync: {}", e))?
    .map(|r| r.0);

    let url = format!("{}/api/sync/pull", api_url);

    // Build JSON body for POST request
    let body = match &last_sync {
        Some(ls) => serde_json::json!({ "last_sync": ls }),
        None => serde_json::json!({}),
    };

    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Error connecting to server: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Server returned {}: {}", status, body));
    }

    // Read as text first so we can produce a useful error log if parsing fails.
    let body_text = resp.text()
        .await
        .map_err(|e| format!("Error reading pull response body: {}", e))?;

    let pull_data: SyncPullResponse = serde_json::from_str(&body_text)
        .map_err(|e| {
            log::error!(
                "Pull response JSON parse error: {}\nServer response (first 3000 chars):\n{}",
                e,
                &body_text[..body_text.len().min(3000)]
            );
            format!("Error parsing pull response: {}", e)
        })?;

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
/// Rows that have local `sync_status = 'pending'` are skipped to avoid
/// overwriting unsent local changes.
async fn apply_catalogs(pool: &SqlitePool, catalogs: &SyncCatalogs) -> Result<(), String> {
    // Dependencias
    for d in &catalogs.dependencias {
        let local_pending = sqlx::query_as::<_, (String,)>(
            "SELECT sync_status FROM dependencia WHERE id = ?"
        ).bind(&d.id).fetch_optional(pool).await.map_err(|e| format!("Error: {}", e))?
         .map(|r| r.0 == "pending").unwrap_or(false);
        if local_pending {
            log::warn!("Skipping server dependencia {} — local pending version exists", d.id);
            continue;
        }
        sqlx::query(
            "INSERT INTO dependencia (id, codigo, dependencia, activo) VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET codigo = excluded.codigo, dependencia = excluded.dependencia, activo = excluded.activo, sync_status = 'synced', sync_operation = 'none'"
        )
        .bind(&d.id).bind(&d.codigo).bind(&d.dependencia).bind(d.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing dependencia: {}", e))?;
    }

    // Tipo cuentas
    for tc in &catalogs.tipo_cuentas {
        let local_pending = sqlx::query_as::<_, (String,)>(
            "SELECT sync_status FROM tipo_cuenta WHERE id = ?"
        ).bind(&tc.id).fetch_optional(pool).await.map_err(|e| format!("Error: {}", e))?
         .map(|r| r.0 == "pending").unwrap_or(false);
        if local_pending {
            log::warn!("Skipping server tipo_cuenta {} — local pending version exists", tc.id);
            continue;
        }
        sqlx::query(
            "INSERT INTO tipo_cuenta (id, tipo, activo) VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET tipo = excluded.tipo, activo = excluded.activo, sync_status = 'synced', sync_operation = 'none'"
        )
        .bind(&tc.id).bind(&tc.tipo).bind(tc.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing tipo_cuenta: {}", e))?;
    }

    // Unidades
    for u in &catalogs.unidades {
        let local_pending = sqlx::query_as::<_, (String,)>(
            "SELECT sync_status FROM unidad_organizacional WHERE id = ?"
        ).bind(&u.id).fetch_optional(pool).await.map_err(|e| format!("Error: {}", e))?
         .map(|r| r.0 == "pending").unwrap_or(false);
        if local_pending {
            log::warn!("Skipping server unidad {} — local pending version exists", u.id);
            continue;
        }
        sqlx::query(
            "INSERT INTO unidad_organizacional (id, id_dependencia, codigo, unidad, activo) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET id_dependencia = excluded.id_dependencia, codigo = excluded.codigo, unidad = excluded.unidad, activo = excluded.activo, sync_status = 'synced', sync_operation = 'none'"
        )
        .bind(&u.id).bind(&u.id_dependencia).bind(u.codigo).bind(&u.unidad).bind(u.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing unidad: {}", e))?;
    }

    // Cuentas contables
    for cc in &catalogs.cuentas_contables {
        let local_pending = sqlx::query_as::<_, (String,)>(
            "SELECT sync_status FROM cuenta_contable WHERE id = ?"
        ).bind(&cc.id).fetch_optional(pool).await.map_err(|e| format!("Error: {}", e))?
         .map(|r| r.0 == "pending").unwrap_or(false);
        if local_pending {
            log::warn!("Skipping server cuenta_contable {} — local pending version exists", cc.id);
            continue;
        }
        sqlx::query(
            "INSERT INTO cuenta_contable (id, id_tipo_cuenta, id_cuenta_padre, codigo, cuenta, nivel, activo) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET id_tipo_cuenta = excluded.id_tipo_cuenta, id_cuenta_padre = excluded.id_cuenta_padre, codigo = excluded.codigo, cuenta = excluded.cuenta, nivel = excluded.nivel, activo = excluded.activo, sync_status = 'synced', sync_operation = 'none'"
        )
        .bind(&cc.id).bind(&cc.id_tipo_cuenta).bind(&cc.id_cuenta_padre).bind(&cc.codigo).bind(&cc.cuenta).bind(cc.nivel).bind(cc.activo)
        .execute(pool).await.map_err(|e| format!("Error syncing cuenta_contable: {}", e))?;
    }

    // Proyectos
    for p in &catalogs.proyectos {
        let local_pending = sqlx::query_as::<_, (String,)>(
            "SELECT sync_status FROM proyecto WHERE id = ?"
        ).bind(&p.id).fetch_optional(pool).await.map_err(|e| format!("Error: {}", e))?
         .map(|r| r.0 == "pending").unwrap_or(false);
        if local_pending {
            log::warn!("Skipping server proyecto {} — local pending version exists", p.id);
            continue;
        }
        sqlx::query(
            "INSERT INTO proyecto (id, nombre, descripcion, pei, activo) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, descripcion = excluded.descripcion, pei = excluded.pei, activo = excluded.activo, sync_status = 'synced', sync_operation = 'none'"
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

/// Apply modificaciones from server pull. Skip rows that have local pending changes.
async fn apply_modificaciones(
    pool: &SqlitePool,
    rows: &[SyncModificacionRow],
) -> Result<(), String> {
    for row in rows {
        // Guard: do not overwrite locally-pending modificaciones
        let local: Option<(String,)> = sqlx::query_as(
            "SELECT sync_status FROM modificacion WHERE id = ?"
        )
        .bind(&row.id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Error: {}", e))?;

        if let Some((status,)) = &local {
            if status == "pending" {
                log::warn!("Conflict detected for modificacion {}, keeping local version", row.id);
                sqlx::query(
                    "UPDATE modificacion SET sync_status = 'conflict' WHERE id = ?"
                )
                .bind(&row.id)
                .execute(pool).await.map_err(|e| format!("Error: {}", e))?;
                continue;
            }
        }

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

/// Apply observaciones from server pull. Skip rows that have local pending changes.
async fn apply_observaciones(
    pool: &SqlitePool,
    rows: &[SyncObservacionRow],
) -> Result<(), String> {
    for row in rows {
        // Guard: do not overwrite locally-pending observaciones (insert-only, no edit)
        let local: Option<(String,)> = sqlx::query_as(
            "SELECT sync_status FROM observacion_certificacion WHERE id = ?"
        )
        .bind(&row.id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Error: {}", e))?;

        if let Some((status,)) = &local {
            if status == "pending" {
                // Observaciones are client-created only — no server conflict possible, just skip
                log::warn!("Skipping server observacion {} — local pending version exists", row.id);
                continue;
            }
        }

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
    token: &str,
) -> Result<(), String> {
    // Gather pending certificaciones
    let cert_rows: Vec<(String, String, String, Option<String>, String, String, i32, i32, String, String, Option<String>, String, String, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario, created_at, updated_at, deleted_at, server_updated_at
             FROM certificacion WHERE sync_status = 'pending'"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Error fetching pending certificaciones: {}", e))?;

    let certificaciones: Vec<SyncCertificacionRow> = cert_rows.into_iter().map(|r| SyncCertificacionRow {
        id: r.0, id_unidad: r.1, id_cuenta_contable: r.2, id_proyecto: r.3,
        generado_por: r.4, concepto: r.5, nro_certificacion: r.6,
        anio_certificacion: r.7, fecha_certificacion: r.8, monto_total: r.9,
        comentario: r.10, created_at: r.11, updated_at: Some(r.12), deleted_at: r.13,
        server_updated_at: r.14,
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
        fecha_hora: r.7, comentario: r.8, created_at: r.9, updated_at: Some(r.10), deleted_at: r.11,
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

    // ============================================================
    // Push pending CATALOG records individually via REST endpoints
    // ============================================================
    // sync_operation = 'create' → POST to create the record on the server
    // sync_operation = 'update' → PUT to update the existing record
    let mut catalog_pushed = 0usize;

    // Pending proyectos
    let pending_proyectos: Vec<(String, String, Option<String>, Option<String>, bool, String)> =
        sqlx::query_as("SELECT id, nombre, descripcion, pei, activo, sync_operation FROM proyecto WHERE sync_status = 'pending'")
            .fetch_all(pool).await
            .map_err(|e| format!("Error fetching pending proyectos: {}", e))?;
    for (id, nombre, descripcion, pei, activo, op) in &pending_proyectos {
        let body = serde_json::json!({ "id": id, "nombre": nombre, "descripcion": descripcion, "pei": pei, "activo": activo });
        if let Some(server_id) = push_catalog_direct(client, api_url, token, "proyectos", id, &body, op == "create" || op == "none").await {
            if &server_id != id {
                log::warn!("proyecto: server returned different id ({} vs local {}); removing stale local record", server_id, id);
                sqlx::query("DELETE FROM proyecto WHERE id = ?").bind(id).execute(pool).await.ok();
            } else {
                sqlx::query("UPDATE proyecto SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
                    .bind(id).execute(pool).await.ok();
            }
            catalog_pushed += 1;
        }
    }

    // Pending dependencias
    let pending_deps: Vec<(String, String, String, bool, String)> =
        sqlx::query_as("SELECT id, codigo, dependencia, activo, sync_operation FROM dependencia WHERE sync_status = 'pending'")
            .fetch_all(pool).await
            .map_err(|e| format!("Error fetching pending dependencias: {}", e))?;
    for (id, codigo, dependencia, activo, op) in &pending_deps {
        let body = serde_json::json!({ "id": id, "codigo": codigo, "dependencia": dependencia, "activo": activo });
        if let Some(server_id) = push_catalog_direct(client, api_url, token, "dependencias", id, &body, op == "create" || op == "none").await {
            if &server_id != id {
                log::warn!("dependencia: server returned different id ({} vs local {}); removing stale local record", server_id, id);
                sqlx::query("DELETE FROM dependencia WHERE id = ?").bind(id).execute(pool).await.ok();
            } else {
                sqlx::query("UPDATE dependencia SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
                    .bind(id).execute(pool).await.ok();
            }
            catalog_pushed += 1;
        }
    }

    // Pending unidades organizacionales
    let pending_units: Vec<(String, String, i32, String, bool, String)> =
        sqlx::query_as("SELECT id, id_dependencia, codigo, unidad, activo, sync_operation FROM unidad_organizacional WHERE sync_status = 'pending'")
            .fetch_all(pool).await
            .map_err(|e| format!("Error fetching pending unidades: {}", e))?;
    for (id, id_dep, codigo, unidad, activo, op) in &pending_units {
        let body = serde_json::json!({ "id": id, "id_dependencia": id_dep, "codigo": codigo, "unidad": unidad, "activo": activo });
        if let Some(server_id) = push_catalog_direct(client, api_url, token, "unidades", id, &body, op == "create" || op == "none").await {
            if &server_id != id {
                log::warn!("unidad: server returned different id ({} vs local {}); removing stale local record", server_id, id);
                sqlx::query("DELETE FROM unidad_organizacional WHERE id = ?").bind(id).execute(pool).await.ok();
            } else {
                sqlx::query("UPDATE unidad_organizacional SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
                    .bind(id).execute(pool).await.ok();
            }
            catalog_pushed += 1;
        }
    }

    // Pending tipos de cuenta
    let pending_tipos: Vec<(String, String, bool, String)> =
        sqlx::query_as("SELECT id, tipo, activo, sync_operation FROM tipo_cuenta WHERE sync_status = 'pending'")
            .fetch_all(pool).await
            .map_err(|e| format!("Error fetching pending tipos de cuenta: {}", e))?;
    for (id, tipo, activo, op) in &pending_tipos {
        let body = serde_json::json!({ "id": id, "tipo": tipo, "activo": activo });
        if let Some(server_id) = push_catalog_direct(client, api_url, token, "tipo-cuentas", id, &body, op == "create" || op == "none").await {
            if &server_id != id {
                log::warn!("tipo_cuenta: server returned different id ({} vs local {}); removing stale local record", server_id, id);
                sqlx::query("DELETE FROM tipo_cuenta WHERE id = ?").bind(id).execute(pool).await.ok();
            } else {
                sqlx::query("UPDATE tipo_cuenta SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
                    .bind(id).execute(pool).await.ok();
            }
            catalog_pushed += 1;
        }
    }

    // Pending cuentas contables
    let pending_cuentas: Vec<(String, String, Option<String>, String, String, i32, bool, String)> =
        sqlx::query_as("SELECT id, id_tipo_cuenta, id_cuenta_padre, codigo, cuenta, nivel, activo, sync_operation FROM cuenta_contable WHERE sync_status = 'pending'")
            .fetch_all(pool).await
            .map_err(|e| format!("Error fetching pending cuentas: {}", e))?;
    for (id, id_tipo, id_padre, codigo, cuenta, _nivel, activo, op) in &pending_cuentas {
        let body = serde_json::json!({ "id": id, "id_tipo_cuenta": id_tipo, "id_cuenta_padre": id_padre, "codigo": codigo, "cuenta": cuenta, "activo": activo });
        if let Some(server_id) = push_catalog_direct(client, api_url, token, "cuentas", id, &body, op == "create" || op == "none").await {
            if &server_id != id {
                log::warn!("cuenta_contable: server returned different id ({} vs local {}); removing stale local record", server_id, id);
                sqlx::query("DELETE FROM cuenta_contable WHERE id = ?").bind(id).execute(pool).await.ok();
            } else {
                sqlx::query("UPDATE cuenta_contable SET sync_status = 'synced', sync_operation = 'none' WHERE id = ?")
                    .bind(id).execute(pool).await.ok();
            }
            catalog_pushed += 1;
        }
    }

    if catalog_pushed > 0 {
        log::info!("Pushed {} pending catalog record(s) to server", catalog_pushed);
    }

    if total == 0 && catalog_pushed == 0 {
        log::info!("No pending changes to push");
        return Ok(());
    } else if total == 0 {
        return Ok(());
    }

    let payload = SyncPushPayload {
        certificaciones,
        modificaciones,
        observaciones,
    };

    let resp = client.post(&format!("{}/api/sync/push", api_url))
        .header("Authorization", format!("Bearer {}", token))
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

/// Attempt an immediate push of all locally-pending records to the server.
/// Best-effort: logs on failure and returns (records will be retried on next periodic sync).
/// Call this inside commands immediately after writing a locally-pending row to SQLite.
pub async fn try_push(
    config: &crate::models::ApiConfig,
    auth_token: &crate::models::AuthToken,
    pool: &SqlitePool,
) {
    let Some(api_url) = config.base_url.clone() else { return };
    let Some(token) = auth_token.token.lock().ok().and_then(|g| g.clone()) else { return };
    let client = Client::new();
    if let Err(e) = push_pending_internal(pool, &client, &api_url, &token).await {
        log::warn!("Immediate push after write failed (will retry on next periodic sync): {}", e);
    }
}

/// Push a single catalog record to the server.
/// Returns `Some(server_id)` on success, `None` on failure.
/// The returned id may differ from the local id when the server ran without the
/// `req.body.id` fix — callers check for this and remove the stale local record
/// so the next pull can insert the canonical server version.
async fn push_catalog_direct(
    client: &Client,
    api_url: &str,
    token: &str,
    path: &str,
    id: &str,
    body: &serde_json::Value,
    is_create: bool,
) -> Option<String> {
    let auth_header = format!("Bearer {}", token);
    if is_create {
        let url = format!("{}/api/{}", api_url, path);
        match client.post(&url)
            .header("Authorization", &auth_header)
            .json(body).send().await
        {
            Ok(resp) if resp.status().is_success() => {
                // Parse the response body to find the server-assigned id.
                // The server may have used a different uuid if it ran old code.
                let server_id = resp.json::<serde_json::Value>().await.ok()
                    .and_then(|v| v.get("id").and_then(|i| i.as_str()).map(String::from))
                    .unwrap_or_else(|| id.to_string());
                Some(server_id)
            }
            Ok(resp) => {
                log::warn!("Catalog push POST {} returned {}", path, resp.status());
                None
            }
            Err(e) => { log::warn!("Catalog push POST {} failed: {}", path, e); None }
        }
    } else {
        let url = format!("{}/api/{}/{}", api_url, path, id);
        match client.put(&url)
            .header("Authorization", &auth_header)
            .json(body).send().await
        {
            Ok(resp) if resp.status().is_success() => Some(id.to_string()),
            Ok(resp) => {
                log::warn!("Catalog push PUT {}/{} returned {}", path, id, resp.status());
                None
            }
            Err(e) => { log::warn!("Catalog push PUT {}/{} failed: {}", path, id, e); None }
        }
    }
}
