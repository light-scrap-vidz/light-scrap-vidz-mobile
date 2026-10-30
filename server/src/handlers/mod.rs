pub mod download;
pub mod info;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Shared application state injected into every handler.
#[derive(Clone)]
pub struct AppState {
    pub registry: Arc<Mutex<HashMap<String, download::Job>>>,
    /// Root directory under which each download gets its own `{id}/` subfolder.
    pub output_root: PathBuf,
    /// Shared secret every request must present (see `auth`).
    pub token: Arc<str>,
    /// Downloads allowed to run at the same time.
    pub max_jobs: usize,
}

/// Deletes finished downloads (folder and registry entry) older than `max_age`.
/// Returns how many were removed.
pub async fn purge_expired(st: &AppState, max_age: std::time::Duration) -> usize {
    let expired: Vec<String> = {
        let reg = st.registry.lock().await;
        reg.iter()
            .filter(|(_, j)| j.done && j.created.elapsed() >= max_age)
            .map(|(id, _)| id.clone())
            .collect()
    };
    for id in &expired {
        let _ = tokio::fs::remove_dir_all(st.output_root.join(id)).await;
        st.registry.lock().await.remove(id);
    }
    expired.len()
}
