mod auth;
mod commands;
mod db;
mod models;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            // Initialize database pool
            let rt = tokio::runtime::Runtime::new().unwrap();
            match rt.block_on(db::create_pool()) {
                Ok(pool) => {
                    app.manage(pool);
                    log::info!("Application started successfully");
                }
                Err(e) => {
                    log::error!("Database connection failed: {}", e);
                    // Show a native error dialog so the user knows what happened
                    rfd::MessageDialog::new()
                        .set_title("Error de conexión")
                        .set_description(&format!(
                            "No se pudo iniciar la aplicación:\n\n{}\n\nVerifique su conexión de red e intente de nuevo.",
                            e
                        ))
                        .set_level(rfd::MessageLevel::Error)
                        .show();
                    std::process::exit(1);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth_cmd::login,
            auth_cmd::verify_token,
            auth_cmd::cambiar_password,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
