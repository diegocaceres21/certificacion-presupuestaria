use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use std::path::PathBuf;

/// Resolve the local SQLite database path.
/// Stores it next to the executable in production, or in a local file during dev.
pub fn resolve_db_path(app_data_dir: &std::path::Path) -> Result<PathBuf, String> {
    // Ensure the directory exists
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("No se pudo crear el directorio de datos: {}", e))?;

    Ok(app_data_dir.join("local.db"))
}

pub async fn create_pool(db_path: &std::path::Path) -> Result<SqlitePool, String> {
    let url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .map_err(|e| format!("No se pudo abrir la base de datos local: {}", e))?;

    // Enable WAL mode for better concurrent read/write performance
    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await
        .map_err(|e| format!("Error configurando WAL: {}", e))?;

    // Enable foreign keys
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(&pool)
        .await
        .map_err(|e| format!("Error habilitando foreign keys: {}", e))?;

    // Run migrations to create/update tables
    initialize_schema(&pool).await?;

    log::info!("Local SQLite database opened successfully at {}", db_path.display());
    Ok(pool)
}

/// Resolve the API base URL from environment or compile-time variable.
pub fn resolve_api_url() -> Option<String> {
    if let Ok(url) = std::env::var("API_URL") {
        return Some(url);
    }
    if let Some(url) = option_env!("API_URL") {
        return Some(url.to_string());
    }
    None
}

async fn initialize_schema(pool: &SqlitePool) -> Result<(), String> {
    // Use raw_sql for multi-statement DDL execution
    sqlx::raw_sql(SCHEMA_SQL)
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando esquema local: {}", e))?;
    Ok(())
}

const SCHEMA_SQL: &str = r#"
-- ============================================
-- LOCAL SQLITE SCHEMA (mirrors MySQL)
-- ============================================

CREATE TABLE IF NOT EXISTS dependencia (
    id TEXT NOT NULL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    dependencia TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tipo_cuenta (
    id TEXT NOT NULL PRIMARY KEY,
    tipo TEXT NOT NULL UNIQUE,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS unidad_organizacional (
    id TEXT NOT NULL PRIMARY KEY,
    id_dependencia TEXT NOT NULL,
    codigo INTEGER NOT NULL,
    unidad TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (id_dependencia) REFERENCES dependencia(id)
);

CREATE TABLE IF NOT EXISTS cuenta_contable (
    id TEXT NOT NULL PRIMARY KEY,
    id_tipo_cuenta TEXT NOT NULL,
    id_cuenta_padre TEXT,
    codigo TEXT NOT NULL UNIQUE,
    cuenta TEXT NOT NULL,
    nivel INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (id_tipo_cuenta) REFERENCES tipo_cuenta(id),
    FOREIGN KEY (id_cuenta_padre) REFERENCES cuenta_contable(id)
);

CREATE TABLE IF NOT EXISTS proyecto (
    id TEXT NOT NULL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    pei TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usuario (
    id TEXT NOT NULL PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS perfil (
    id TEXT NOT NULL PRIMARY KEY,
    id_usuario TEXT NOT NULL UNIQUE,
    nombre_completo TEXT NOT NULL,
    cargo TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'lector',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS certificacion (
    id TEXT NOT NULL PRIMARY KEY,
    id_unidad TEXT NOT NULL,
    id_cuenta_contable TEXT NOT NULL,
    id_proyecto TEXT,
    generado_por TEXT NOT NULL,
    concepto TEXT NOT NULL,
    nro_certificacion INTEGER NOT NULL,
    anio_certificacion INTEGER NOT NULL,
    fecha_certificacion TEXT NOT NULL,
    monto_total TEXT NOT NULL,
    comentario TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'synced',
    local_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    server_updated_at TEXT,
    conflict_data TEXT,
    FOREIGN KEY (id_unidad) REFERENCES unidad_organizacional(id),
    FOREIGN KEY (id_cuenta_contable) REFERENCES cuenta_contable(id),
    FOREIGN KEY (id_proyecto) REFERENCES proyecto(id),
    FOREIGN KEY (generado_por) REFERENCES usuario(id)
);

CREATE TABLE IF NOT EXISTS modificacion (
    id TEXT NOT NULL PRIMARY KEY,
    id_certificacion TEXT NOT NULL,
    modificado_por TEXT NOT NULL,
    monto_antiguo TEXT,
    monto_nuevo TEXT,
    concepto_antiguo TEXT,
    concepto_nuevo TEXT,
    fecha_hora TEXT NOT NULL,
    comentario TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'synced',
    FOREIGN KEY (id_certificacion) REFERENCES certificacion(id),
    FOREIGN KEY (modificado_por) REFERENCES usuario(id)
);

CREATE TABLE IF NOT EXISTS observacion_certificacion (
    id TEXT NOT NULL PRIMARY KEY,
    id_certificacion TEXT NOT NULL,
    creado_por TEXT NOT NULL,
    comentario TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'synced',
    FOREIGN KEY (id_certificacion) REFERENCES certificacion(id),
    FOREIGN KEY (creado_por) REFERENCES usuario(id)
);

-- Sync tracking table
CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cert_unidad ON certificacion(id_unidad);
CREATE INDEX IF NOT EXISTS idx_cert_cuenta ON certificacion(id_cuenta_contable);
CREATE INDEX IF NOT EXISTS idx_cert_sync ON certificacion(sync_status);
CREATE INDEX IF NOT EXISTS idx_cert_deleted ON certificacion(deleted_at);
CREATE INDEX IF NOT EXISTS idx_mod_cert ON modificacion(id_certificacion);
CREATE INDEX IF NOT EXISTS idx_obs_cert ON observacion_certificacion(id_certificacion);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_nro_anio ON certificacion(nro_certificacion, anio_certificacion);
"#;

