use regex::Regex;
use std::sync::LazyLock;

static PROGRESS_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^\[download\]\s+([\d.]+)%\s+of\s+~?[\d.]+\s*\w+\s+at\s+([\d.]+\s*\w+/s|Unknown\s*B/s)\s+ETA\s+([\d:]+|Unknown)",
    )
    .unwrap()
});

static DESTINATION_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\[download\] Destination: (.+)$").unwrap());

static PLAYLIST_ITEM_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\[download\] Downloading item (\d+) of (\d+)").unwrap());

#[derive(Debug, PartialEq)]
pub struct PlaylistItemLine {
    pub current_item: u32,
    pub total_items: u32,
}

pub fn parse_playlist_item_line(line: &str) -> Option<PlaylistItemLine> {
    let caps = PLAYLIST_ITEM_RE.captures(line.trim())?;
    let current_item: u32 = caps[1].parse().ok()?;
    let total_items: u32 = caps[2].parse().ok()?;
    Some(PlaylistItemLine {
        current_item,
        total_items,
    })
}

#[derive(Debug, PartialEq)]
pub struct ProgressLine {
    pub percent: f32,
    pub speed: String,
    pub eta: String,
}

pub fn parse_progress_line(line: &str) -> Option<ProgressLine> {
    let caps = PROGRESS_RE.captures(line.trim())?;
    let percent: f32 = caps[1].parse().ok()?;
    let speed = caps[2].trim().to_string();
    let eta = caps[3].trim().to_string();
    Some(ProgressLine {
        percent,
        speed,
        eta,
    })
}

pub fn parse_destination_line(line: &str) -> Option<String> {
    let caps = DESTINATION_RE.captures(line.trim())?;
    Some(caps[1].trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_typical_progress() {
        let line = "[download]  47.3% of   18.23MiB at   1.23MiB/s ETA 00:09";
        let p = parse_progress_line(line).unwrap();
        assert!((p.percent - 47.3).abs() < 0.01);
        assert!(p.speed.contains("MiB/s"));
        assert_eq!(p.eta, "00:09");
    }

    #[test]
    fn test_parse_unknown_speed_and_eta() {
        let line = "[download]   0.0% of  ~18.23MiB at  Unknown B/s ETA Unknown";
        let p = parse_progress_line(line).unwrap();
        assert!((p.percent - 0.0).abs() < 0.01);
        assert_eq!(p.eta, "Unknown");
    }

    #[test]
    fn test_parse_destination() {
        let line = "[download] Destination: /tmp/abc/my video.mp4";
        assert_eq!(
            parse_destination_line(line),
            Some("/tmp/abc/my video.mp4".to_string())
        );
    }

    #[test]
    fn test_parse_playlist_item() {
        let line = "[download] Downloading item 3 of 10";
        assert_eq!(
            parse_playlist_item_line(line).unwrap(),
            PlaylistItemLine {
                current_item: 3,
                total_items: 10
            }
        );
    }

    #[test]
    fn test_non_matching_line() {
        assert!(parse_progress_line("[info] Some other line").is_none());
        assert!(parse_destination_line("[info] Some other line").is_none());
        assert!(parse_playlist_item_line("[info] some line").is_none());
    }
}
