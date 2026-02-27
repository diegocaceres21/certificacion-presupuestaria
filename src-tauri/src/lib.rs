mod api_forward;
mod auth;
mod commands;
mod db;
mod models;
mod sync;

use tauri::Manager;
use commands::auth_cmd;
use commands::certificaciones;
use commands::cuentas;
use commands::modificaciones;
use commands::observaciones;
use commands::proyectos;
use commands::reportes;
use commands::tipo_cuentas;
use commands::unidades;
use commands::usuarios;
use commands::sync_cmd;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            // Resolve local database path in the app data directory
            let app_data_dir = app.path().app_data_dir()
                .map_err(|e| format!("No se pudo obtener el directorio de datos: {}", e))
                .expect("app data dir");
            let db_path = db::resolve_db_path(&app_data_dir)
                .expect("resolve db path");

            // Initialize SQLite pool using Tauri's async runtime
            match tauri::async_runtime::block_on(db::create_pool(&db_path)) {
                Ok(pool) => {
                    // Run idempotent column migrations (adds sync_status to catalog tables on existing DBs)
                    tauri::async_runtime::block_on(db::run_column_migrations(&pool));
                    app.manage(pool);
                    log::info!("Local database initialized successfully");
                }
                Err(e) => {
                    log::error!("Local database init failed: {}", e);
                    rfd::MessageDialog::new()
                        .set_title("Error de base de datos")
                        .set_description(&format!(
                            "No se pudo iniciar la aplicación:\n\n{}\n\nIntente de nuevo.",
                            e
                        ))
                        .set_level(rfd::MessageLevel::Error)
                        .show();
                    std::process::exit(1);
                }
            }

            // Store API URL in managed state (may be None if not configured)
            let api_url = db::resolve_api_url();
            app.manage(models::ApiConfig { base_url: api_url });

            // Store auth token holder (initially empty, set on login)
            app.manage(models::AuthToken {
                token: std::sync::Mutex::new(None),
            });

            // NOTE: initial sync is deferred until after the user logs in.
            // The login command triggers a post-login sync automatically.

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth_cmd::login,
            auth_cmd::verify_token,
            auth_cmd::cambiar_password,
            auth_cmd::logout,
            // Certificaciones
            certificaciones::listar_certificaciones,
            certificaciones::obtener_certificacion,
            certificaciones::crear_certificacion,
            certificaciones::editar_certificacion,
            certificaciones::eliminar_certificacion,
            // Modificaciones
            modificaciones::listar_modificaciones,
            // Observaciones
            observaciones::listar_observaciones,
            observaciones::crear_observacion,
            // Unidades y Dependencias
            unidades::listar_dependencias,
            unidades::crear_dependencia,
            unidades::editar_dependencia,
            unidades::listar_unidades,
            unidades::crear_unidad,
            unidades::editar_unidad,
            // Tipos de cuenta
            tipo_cuentas::listar_tipo_cuentas,
            tipo_cuentas::crear_tipo_cuenta,
            tipo_cuentas::editar_tipo_cuenta,
            // Cuentas contables
            cuentas::listar_cuentas,
            cuentas::crear_cuenta,
            cuentas::editar_cuenta,
            // Proyectos
            proyectos::listar_proyectos,
            proyectos::crear_proyecto,
            proyectos::editar_proyecto,
            // Usuarios
            usuarios::listar_usuarios,
            usuarios::listar_usuarios_simple,
            usuarios::crear_usuario,
            usuarios::editar_usuario,
            usuarios::resetear_password,
            // Reportes
            reportes::obtener_reporte,
            reportes::reporte_detalle_unidad,
            reportes::reporte_detalle_cuenta,
            // Sync
            sync_cmd::sync_now,
            sync_cmd::get_sync_status,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Push pending changes before closing
                let app_handle = window.app_handle().clone();
                tauri::async_runtime::block_on(async {
                    if let Err(e) = sync::push_pending(&app_handle).await {
                        log::warn!("Sync on close failed: {}", e);
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
