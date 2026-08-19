//! HTTP-level integration tests for the axum router.
//!
//! These drive the router in-process via `tower::ServiceExt::oneshot`, so they
//! need neither a bound TCP socket nor network access. They cover the routing
//! and request-validation layer; cases that would actually shell out to
//! `yt-dlp` (a valid `/api/info?url=...`, a real download) are intentionally
//! left to manual / e2e verification to keep the suite hermetic and fast.

use std::collections::HashMap;
use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tokio::sync::Mutex;
use tower::ServiceExt;

use light_scrap_vidz_server::build_router;
use light_scrap_vidz_server::handlers::AppState;

fn test_state() -> AppState {
    AppState {
        registry: Arc::new(Mutex::new(HashMap::new())),
        output_root: std::env::temp_dir().join("lsv-test-output"),
    }
}

async fn body_string(body: Body) -> String {
    let bytes = body.collect().await.unwrap().to_bytes();
    String::from_utf8(bytes.to_vec()).unwrap()
}

#[tokio::test]
async fn health_returns_ok() {
    let app = build_router(test_state());
    let res = app
        .oneshot(Request::get("/api/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_string(res.into_body()).await, "ok");
}

#[tokio::test]
async fn info_without_url_is_bad_request() {
    // `Query<InfoQuery>` requires `url`; extraction fails before any yt-dlp call.
    let app = build_router(test_state());
    let res = app
        .oneshot(Request::get("/api/info").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn download_with_empty_body_is_unprocessable() {
    // `{}` is valid JSON but misses the required `url` field → 422.
    let app = build_router(test_state());
    let res = app
        .oneshot(
            Request::post("/api/download")
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn files_for_unknown_id_is_not_found() {
    let app = build_router(test_state());
    let res = app
        .oneshot(
            Request::get("/api/download/does-not-exist/files")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn cancel_for_unknown_id_is_ok() {
    // Cancelling a job that isn't in the registry is a no-op that still 200s,
    // so the client can fire-and-forget without special-casing races.
    let app = build_router(test_state());
    let res = app
        .oneshot(
            Request::post("/api/download/does-not-exist/cancel")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn serving_a_missing_file_is_not_found() {
    let app = build_router(test_state());
    let res = app
        .oneshot(
            Request::get("/files/nope/nope.mp4")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
