use axum::{extract::Query, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::process::Stdio;

use crate::ytdlp::{
    builder::{InfoCommand, PlaylistInfoCommand},
    finder::YtDlpBinary,
};

#[derive(Deserialize)]
pub struct InfoQuery {
    pub url: String,
    /// Optional browser whose cookies the *server* should use (server-side browser).
    pub cookies: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FormatInfo {
    pub format_id: String,
    #[serde(default)]
    pub ext: String,
    pub height: Option<i32>,
    pub filesize: Option<i64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoInfoResponse {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub thumbnail: String,
    #[serde(default)]
    pub duration: f64,
    #[serde(default)]
    pub uploader: String,
    #[serde(default)]
    pub webpage_url: String,
    #[serde(default)]
    pub extractor: String,
    #[serde(default)]
    pub formats: Vec<FormatInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PlaylistEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistInfoResponse {
    #[serde(rename = "_type", default)]
    pub kind: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub uploader: String,
    pub playlist_count: Option<u32>,
    #[serde(default)]
    pub entries: Vec<PlaylistEntry>,
}

type ApiError = (StatusCode, String);

pub async fn video_info(Query(q): Query<InfoQuery>) -> Result<Json<VideoInfoResponse>, ApiError> {
    let binary = YtDlpBinary::find().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let cmd = InfoCommand {
        binary: binary.path().to_path_buf(),
        url: q.url,
        cookies_browser: q.cookies,
    }
    .build();

    let output = tokio::process::Command::from(cmd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to run yt-dlp: {e}"),
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("yt-dlp error: {}", stderr.trim()),
        ));
    }

    let json = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<VideoInfoResponse>(&json)
        .map(Json)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse video info: {e}"),
            )
        })
}

pub async fn playlist_info(
    Query(q): Query<InfoQuery>,
) -> Result<Json<PlaylistInfoResponse>, ApiError> {
    let binary = YtDlpBinary::find().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let cmd = PlaylistInfoCommand {
        binary: binary.path().to_path_buf(),
        url: q.url,
        peek: 5,
        cookies_browser: q.cookies,
    }
    .build();

    let output = tokio::process::Command::from(cmd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to run yt-dlp: {e}"),
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("yt-dlp error: {}", stderr.trim()),
        ));
    }

    let json = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<PlaylistInfoResponse>(&json)
        .map(Json)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse playlist info: {e}"),
            )
        })
}
