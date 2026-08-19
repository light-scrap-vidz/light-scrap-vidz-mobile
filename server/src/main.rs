use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::Mutex;

use light_scrap_vidz_server::build_router;
use light_scrap_vidz_server::handlers::AppState;

#[tokio::main]
async fn main() {
    // Where downloaded files live. Each download gets an `{output_root}/{id}/` folder,
    // served read-only under `/files/{id}/{name}`.
    let output_root: PathBuf = std::env::var("OUTPUT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join("light-scrap-vidz"));
    std::fs::create_dir_all(&output_root).expect("failed to create output dir");

    let state = AppState {
        registry: Arc::new(Mutex::new(HashMap::new())),
        output_root: output_root.clone(),
    };

    let app = build_router(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8787".to_string());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| panic!("failed to bind {addr}: {e}"));

    println!("light-scrap-vidz server listening on http://{addr}");
    println!("output dir: {}", output_root.display());
    axum::serve(listener, app).await.expect("server error");
}
