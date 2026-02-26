use sqlx::SqlitePool;
use tauri::State;

use crate::models::*;
use crate::sync;

#[tauri::command]
pub async fn sync_now(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
) -> Result<SyncStatus, String> {
    let api_url = config.base_url.clone()
        .ok_or_else(|| "API URL not configured. Sync is not available.".to_string())?;

    sync::full_sync(pool.inner(), &api_url).await
}

#[tauri::command]
pub async fn get_sync_status(
    pool: State<'_, SqlitePool>,
    config: State<'_, ApiConfig>,
) -> Result<SyncStatus, String> {
    let api_url = config.base_url.as_deref().unwrap_or("");
    sync::get_sync_status_internal(pool.inner(), api_url).await
}
