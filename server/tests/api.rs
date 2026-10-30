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
        token: "secret".into(),
        max_jobs: 4,
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
        .oneshot(
            Request::get("/api/health")
                .header("authorization", "Bearer secret")
                .body(Body::empty())
                .unwrap(),
        )
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
        .oneshot(
            Request::get("/api/info")
                .header("authorization", "Bearer secret")
                .body(Body::empty())
                .unwrap(),
        )
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
                .header("authorization", "Bearer secret")
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
                .header("authorization", "Bearer secret")
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
                .header("authorization", "Bearer secret")
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
                .header("authorization", "Bearer secret")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

fn authed(method: &str, uri: &str, body: Body) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header("authorization", "Bearer secret")
        .header("content-type", "application/json")
        .body(body)
        .unwrap()
}

#[tokio::test]
async fn a_request_without_the_token_is_refused() {
    for uri in [
        "/api/health",
        "/api/info?url=https://a.test",
        "/files/x/y.mp4",
    ] {
        let res = build_router(test_state())
            .oneshot(Request::get(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED, "{uri}");
    }
}

#[tokio::test]
async fn a_wrong_token_is_refused_and_the_query_token_works() {
    let wrong = build_router(test_state())
        .oneshot(
            Request::get("/api/health")
                .header("authorization", "Bearer nope")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);

    let ok = build_router(test_state())
        .oneshot(
            Request::get("/api/health?token=secret")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(ok.status(), StatusCode::OK);
}

#[tokio::test]
async fn an_option_is_not_accepted_as_a_url() {
    for uri in [
        "/api/info?url=--exec%3Devil",
        "/api/playlist?url=file%3A%2F%2F%2Fetc%2Fpasswd",
        "/api/info?url=https%3A%2F%2Fa.test&cookies=firefox%3A%2Ftmp",
    ] {
        let res = build_router(test_state())
            .oneshot(authed("GET", uri, Body::empty()))
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST, "{uri}");
    }
    let res = build_router(test_state())
        .oneshot(authed(
            "POST",
            "/api/download",
            Body::from(r#"{"url":"--exec=evil"}"#),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn too_many_running_downloads_are_refused() {
    use light_scrap_vidz_server::handlers::download::Job;
    let st = AppState {
        max_jobs: 1,
        ..test_state()
    };
    let (tx, _rx) = tokio::sync::broadcast::channel(4);
    st.registry.lock().await.insert(
        "busy".into(),
        Job {
            child: None,
            tx,
            done: false,
            files: vec![],
            error: None,
            created: std::time::Instant::now(),
        },
    );
    let res = build_router(st)
        .oneshot(authed(
            "POST",
            "/api/download",
            Body::from(r#"{"url":"https://a.test/v"}"#),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::TOO_MANY_REQUESTS);
}

#[tokio::test]
async fn finished_downloads_are_purged_but_running_ones_are_kept() {
    use light_scrap_vidz_server::handlers::{download::Job, purge_expired};
    let st = test_state();
    let dir = st.output_root.join("old-job");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("a.mp4"), b"x").unwrap();
    let (tx, _rx) = tokio::sync::broadcast::channel(4);
    let job = |done| Job {
        child: None,
        tx: tx.clone(),
        done,
        files: vec![],
        error: None,
        created: std::time::Instant::now(),
    };
    {
        let mut reg = st.registry.lock().await;
        reg.insert("old-job".into(), job(true));
        reg.insert("running".into(), job(false));
    }
    assert_eq!(purge_expired(&st, std::time::Duration::ZERO).await, 1);
    assert!(!dir.exists());
    let reg = st.registry.lock().await;
    assert!(reg.contains_key("running") && !reg.contains_key("old-job"));
}
