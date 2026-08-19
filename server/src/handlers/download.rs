use std::path::PathBuf;
use std::process::Stdio;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::Response,
    Json,
};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::broadcast;

use crate::handlers::AppState;
use crate::ytdlp::{
    builder::{DownloadCommand, PlaylistDownloadCommand, Quality},
    finder::YtDlpBinary,
    parser::{parse_destination_line, parse_playlist_item_line, parse_progress_line},
};

/// A live or finished download. `child` is kept only so `/cancel` can kill it;
/// the worker task owns the stdout/stderr handles directly.
pub struct Job {
    pub child: Option<Child>,
    pub tx: broadcast::Sender<DownloadEvent>,
    pub done: bool,
    pub files: Vec<String>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum DownloadEvent {
    Progress {
        percent: f32,
        speed: String,
        eta: String,
        filename: String,
        current_item: Option<u32>,
        total_items: Option<u32>,
    },
    Complete {
        files: Vec<String>,
    },
    Error {
        message: String,
    },
}

#[derive(Deserialize)]
pub struct StartRequest {
    pub url: String,
    #[serde(default = "default_quality")]
    pub quality: String,
    #[serde(default)]
    pub audio_only: bool,
    /// `Some(n)` → playlist download limited to n items (0 = all). `None` → single video.
    #[serde(default)]
    pub playlist_end: Option<u32>,
    #[serde(default)]
    pub cookies: Option<String>,
}

fn default_quality() -> String {
    "best".to_string()
}

#[derive(Serialize)]
pub struct StartResponse {
    pub download_id: String,
}

#[derive(Serialize)]
pub struct FilesResponse {
    pub files: Vec<String>,
    pub done: bool,
    pub error: Option<String>,
}

type ApiError = (StatusCode, String);

pub async fn start(
    State(st): State<AppState>,
    Json(req): Json<StartRequest>,
) -> Result<Json<StartResponse>, ApiError> {
    let binary = YtDlpBinary::find().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let id = uuid::Uuid::new_v4().to_string();
    let output_dir: PathBuf = st.output_root.join(&id);
    tokio::fs::create_dir_all(&output_dir)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let q = Quality::from_str(&req.quality);
    let binary_path = binary.path().to_path_buf();

    let spawn_result = match req.playlist_end {
        Some(n) => {
            let end = if n == 0 { None } else { Some(n) };
            let cmd = PlaylistDownloadCommand {
                binary: binary_path,
                url: req.url,
                output_dir: output_dir.clone(),
                quality: q,
                playlist_end: end,
                cookies_browser: req.cookies,
                audio_only: req.audio_only,
            };
            tokio::process::Command::from(cmd.build())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
        }
        None => {
            let cmd = DownloadCommand {
                binary: binary_path,
                url: req.url,
                output_dir: output_dir.clone(),
                quality: q,
                cookies_browser: req.cookies,
                audio_only: req.audio_only,
            };
            tokio::process::Command::from(cmd.build())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
        }
    };

    let mut process = spawn_result.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to spawn yt-dlp: {e}"),
        )
    })?;

    let stdout = process.stdout.take().unwrap();
    let stderr = process.stderr.take().unwrap();
    let (tx, _rx) = broadcast::channel::<DownloadEvent>(256);

    {
        let mut reg = st.registry.lock().await;
        reg.insert(
            id.clone(),
            Job {
                child: Some(process),
                tx: tx.clone(),
                done: false,
                files: vec![],
                error: None,
            },
        );
    }

    let registry = st.registry.clone();
    let worker_id = id.clone();
    let worker_dir = output_dir.clone();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut last_filename = String::new();
        let mut current_item: Option<u32> = None;
        let mut total_items: Option<u32> = None;

        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(dest) = parse_destination_line(&line) {
                last_filename = dest;
            }
            if let Some(pi) = parse_playlist_item_line(&line) {
                current_item = Some(pi.current_item);
                total_items = Some(pi.total_items);
            }
            if let Some(p) = parse_progress_line(&line) {
                let _ = tx.send(DownloadEvent::Progress {
                    percent: p.percent,
                    speed: p.speed,
                    eta: p.eta,
                    filename: last_filename.rsplit('/').next().unwrap_or("").to_string(),
                    current_item,
                    total_items,
                });
            }
        }

        // Drain stderr so the pipe never blocks; keep the last meaningful line.
        let mut err_reader = BufReader::new(stderr).lines();
        let mut stderr_last = String::new();
        while let Ok(Some(line)) = err_reader.next_line().await {
            if !line.trim().is_empty() {
                stderr_last = line;
            }
        }

        // If `/cancel` already removed the child, treat as cancelled and stay silent.
        let cancelled = {
            let mut reg = registry.lock().await;
            match reg.get_mut(&worker_id) {
                Some(job) => job.child.take().is_none(),
                None => true,
            }
        };
        if cancelled {
            return;
        }

        // List the files yt-dlp produced in this job's directory.
        let mut files: Vec<String> = Vec::new();
        if let Ok(mut rd) = tokio::fs::read_dir(&worker_dir).await {
            while let Ok(Some(entry)) = rd.next_entry().await {
                if entry
                    .file_type()
                    .await
                    .map(|t| t.is_file())
                    .unwrap_or(false)
                {
                    if let Some(name) = entry.file_name().to_str() {
                        files.push(name.to_string());
                    }
                }
            }
        }
        files.sort();

        if files.is_empty() {
            let msg = if stderr_last.is_empty() {
                "Download failed — no file produced.".to_string()
            } else {
                stderr_last
            };
            {
                let mut reg = registry.lock().await;
                if let Some(job) = reg.get_mut(&worker_id) {
                    job.error = Some(msg.clone());
                    job.done = true;
                }
            }
            let _ = tx.send(DownloadEvent::Error { message: msg });
        } else {
            {
                let mut reg = registry.lock().await;
                if let Some(job) = reg.get_mut(&worker_id) {
                    job.files = files.clone();
                    job.done = true;
                }
            }
            let _ = tx.send(DownloadEvent::Complete { files });
        }
    });

    Ok(Json(StartResponse { download_id: id }))
}

pub async fn ws(
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    State(st): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, id, st))
}

async fn handle_socket(mut socket: WebSocket, id: String, st: AppState) {
    // Subscribe while holding the lock so we can't miss the terminal event:
    // the worker sets `done` under the same lock *before* it broadcasts.
    let (mut rx, terminal) = {
        let reg = st.registry.lock().await;
        match reg.get(&id) {
            Some(job) => {
                let term = if job.done {
                    Some(match &job.error {
                        Some(msg) => DownloadEvent::Error {
                            message: msg.clone(),
                        },
                        None => DownloadEvent::Complete {
                            files: job.files.clone(),
                        },
                    })
                } else {
                    None
                };
                (job.tx.subscribe(), term)
            }
            None => {
                let _ = socket.send(Message::Close(None)).await;
                return;
            }
        }
    };

    if let Some(ev) = terminal {
        let _ = socket.send(Message::Text(to_json(&ev))).await;
        let _ = socket.send(Message::Close(None)).await;
        return;
    }

    loop {
        match rx.recv().await {
            Ok(ev) => {
                let is_terminal = matches!(
                    ev,
                    DownloadEvent::Complete { .. } | DownloadEvent::Error { .. }
                );
                if socket.send(Message::Text(to_json(&ev))).await.is_err() {
                    break;
                }
                if is_terminal {
                    let _ = socket.send(Message::Close(None)).await;
                    break;
                }
            }
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

fn to_json(ev: &DownloadEvent) -> String {
    serde_json::to_string(ev).unwrap_or_else(|_| "{}".to_string())
}

pub async fn cancel(Path(id): Path<String>, State(st): State<AppState>) -> StatusCode {
    let mut reg = st.registry.lock().await;
    if let Some(job) = reg.get_mut(&id) {
        if let Some(mut child) = job.child.take() {
            let _ = child.start_kill();
        }
    }
    StatusCode::OK
}

pub async fn files(
    Path(id): Path<String>,
    State(st): State<AppState>,
) -> Result<Json<FilesResponse>, StatusCode> {
    let reg = st.registry.lock().await;
    match reg.get(&id) {
        Some(job) => Ok(Json(FilesResponse {
            files: job.files.clone(),
            done: job.done,
            error: job.error.clone(),
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}
