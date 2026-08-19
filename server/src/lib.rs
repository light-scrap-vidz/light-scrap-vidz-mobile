pub mod handlers;
pub mod ytdlp;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use handlers::AppState;

/// Builds the application router. Kept separate from `main` so integration
/// tests can exercise the routes without binding a TCP socket.
pub fn build_router(state: AppState) -> Router {
    let output_root = state.output_root.clone();
    Router::new()
        .route("/api/health", get(|| async { "ok" }))
        .route("/api/info", get(handlers::info::video_info))
        .route("/api/playlist", get(handlers::info::playlist_info))
        .route("/api/download", post(handlers::download::start))
        .route("/api/download/:id/ws", get(handlers::download::ws))
        .route("/api/download/:id/cancel", post(handlers::download::cancel))
        .route("/api/download/:id/files", get(handlers::download::files))
        .nest_service("/files", ServeDir::new(&output_root))
        .layer(CorsLayer::permissive())
        .with_state(state)
}
