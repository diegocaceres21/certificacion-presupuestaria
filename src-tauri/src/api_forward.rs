//! Forward local catalog writes to the remote REST API.
//!
//! Every function here is best-effort: if the API is unreachable or returns
//! an error we log it and return `Ok(())` so that offline-first behaviour
//! is preserved.  The next sync pull will reconcile data in any case.

use reqwest::Client;
use serde::Serialize;

use crate::models::{ApiConfig, AuthToken};

/// Convenience: resolve base URL + auth token from managed state.
/// Returns `None` when the API URL is not configured or there is no token
/// (i.e. offline / not logged-in).
fn resolve(config: &ApiConfig, auth: &AuthToken) -> Option<(String, String)> {
    let base_url = config.base_url.as_ref()?.clone();
    let token = auth.token.lock().ok()?.clone()?;
    Some((base_url, token))
}

/// POST a JSON body to `{base_url}/api/{path}`. Returns `true` if the server accepted it.
pub async fn post<T: Serialize>(
    config: &ApiConfig,
    auth: &AuthToken,
    path: &str,
    body: &T,
) -> bool {
    let Some((base_url, token)) = resolve(config, auth) else { return false };
    let url = format!("{}/api/{}", base_url, path);
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            log::info!("API forward POST {} succeeded", path);
            true
        }
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            log::warn!("API forward POST {} returned {}: {}", path, status, body);
            false
        }
        Err(e) => {
            log::warn!("API forward POST {} failed: {}", path, e);
            false
        }
    }
}

/// PUT a JSON body to `{base_url}/api/{path}/{id}`. Returns `true` if the server accepted it.
pub async fn put<T: Serialize>(
    config: &ApiConfig,
    auth: &AuthToken,
    path: &str,
    id: &str,
    body: &T,
) -> bool {
    let Some((base_url, token)) = resolve(config, auth) else { return false };
    let url = format!("{}/api/{}/{}", base_url, path, id);
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    match client
        .put(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            log::info!("API forward PUT {}/{} succeeded", path, id);
            true
        }
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            log::warn!("API forward PUT {}/{} returned {}: {}", path, id, status, body);
            false
        }
        Err(e) => {
            log::warn!("API forward PUT {}/{} failed: {}", path, id, e);
            false
        }
    }
}
