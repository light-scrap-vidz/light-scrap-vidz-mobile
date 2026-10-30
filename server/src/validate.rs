//! Checks on what a client sends before it reaches yt-dlp. The same rules as the desktop app.

/// Browsers yt-dlp can read cookies from. `--cookies-from-browser` also accepts
/// `BROWSER:PROFILE_PATH`, so a free string is never passed through.
pub const BROWSERS: &[&str] = &[
    "firefox", "chrome", "chromium", "safari", "brave", "edge", "opera", "vivaldi",
];

pub fn cookies_browser(browser: &Option<String>) -> Result<(), String> {
    match browser {
        Some(b) if !BROWSERS.contains(&b.as_str()) => Err("Unsupported browser".to_string()),
        _ => Ok(()),
    }
}

/// Only web addresses are handed to yt-dlp (never a local path, never an option).
pub fn url(raw: &str) -> Result<(), String> {
    let raw = raw.trim();
    if raw.len() > 2048 || raw.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Unsupported URL".to_string());
    }
    match url::Url::parse(raw) {
        Ok(u) if matches!(u.scheme(), "http" | "https") && u.host_str().is_some() => Ok(()),
        _ => Err("Unsupported URL".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_web_urls_pass() {
        assert!(url("https://www.youtube.com/watch?v=abc").is_ok());
        assert!(url("http://example.com/a").is_ok());
        for bad in [
            "--exec=evil",
            "-o /etc/passwd",
            "file:///etc/passwd",
            "ftp://x.test/a",
            "https://",
            "https://a.test/x y",
            "",
            "javascript:alert(1)",
        ] {
            assert!(url(bad).is_err(), "{bad} must be refused");
        }
    }

    #[test]
    fn a_long_url_is_refused() {
        assert!(url(&format!("https://a.test/{}", "x".repeat(3000))).is_err());
    }

    #[test]
    fn known_browsers_pass_and_a_profile_path_does_not() {
        assert!(cookies_browser(&None).is_ok());
        assert!(cookies_browser(&Some("firefox".into())).is_ok());
        assert!(cookies_browser(&Some("firefox:/home/x/.mozilla".into())).is_err());
        assert!(cookies_browser(&Some("--exec=x".into())).is_err());
    }
}
