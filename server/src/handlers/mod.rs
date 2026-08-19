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
}
