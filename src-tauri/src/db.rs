use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;
use std::env;

/// Resolve the database URL using the following priority:
/// 1. Runtime environment variable (set via .env in development)
/// 2. Compile-time environment variable (embedded during CI build)
pub fn resolve_database_url() -> Result<String, String> {
    // 1. Runtime env (loaded from .env by dotenvy in dev)
    if let Ok(url) = env::var("DATABASE_URL") {
        return Ok(url);
    }

    // 2. Compile-time env (embedded during CI/CD build)
    if let Some(url) = option_env!("DATABASE_URL") {
        return Ok(url.to_string());
    }

    Err("DATABASE_URL no está configurada. Contacte al administrador del sistema.".to_string())
}

pub async fn create_pool() -> Result<MySqlPool, String> {
    let database_url = resolve_database_url()?;

    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .map_err(|e| format!("No se pudo conectar a la base de datos: {}", e))?;

    log::info!("Database connection pool created successfully");
    Ok(pool)
}
