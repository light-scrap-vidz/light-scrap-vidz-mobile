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

    // Every request must carry this secret. Without AUTH_TOKEN a random one is made at
    // each start and printed, so a server is never open by default.
    let token = std::env::var("AUTH_TOKEN")
        .ok()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| {
            let t = uuid::Uuid::new_v4().simple().to_string();
            println!("AUTH_TOKEN not set: using a generated token for this run: {t}");
            t
        });
    let env_num = |name: &str, default: u64| {
        std::env::var(name)
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(default)
    };

    let state = AppState {
        registry: Arc::new(Mutex::new(HashMap::new())),
        output_root: output_root.clone(),
        token: token.as_str().into(),
        max_jobs: env_num("MAX_JOBS", 4) as usize,
    };

    // Finished downloads are removed after RETENTION_HOURS (default 24).
    let retention = std::time::Duration::from_secs(env_num("RETENTION_HOURS", 24) * 3600);
    let sweeper = state.clone();
    tokio::spawn(async move {
        loop {
            light_scrap_vidz_server::handlers::purge_expired(&sweeper, retention).await;
            tokio::time::sleep(std::time::Duration::from_secs(600)).await;
        }
    });

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
