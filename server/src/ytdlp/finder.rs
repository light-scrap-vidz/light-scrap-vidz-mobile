use std::path::{Path, PathBuf};

const FALLBACK_PATHS: &[&str] = &[
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "/opt/homebrew/bin/yt-dlp",
    "/opt/local/bin/yt-dlp",
];

pub struct YtDlpBinary {
    path: PathBuf,
}

impl YtDlpBinary {
    pub fn find() -> Result<Self, String> {
        // 1. Explicit env var override
        if let Ok(p) = std::env::var("YTDLP_PATH") {
            let path = PathBuf::from(&p);
            if path.is_file() {
                return Ok(Self { path });
            }
        }

        // 2. Search $PATH
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in path_var.split(':') {
                let candidate = PathBuf::from(dir).join("yt-dlp");
                if candidate.is_file() {
                    return Ok(Self { path: candidate });
                }
            }
        }

        // 3. ~/.local/bin/yt-dlp (pip --user installs)
        if let Ok(home) = std::env::var("HOME") {
            let candidate = PathBuf::from(home).join(".local/bin/yt-dlp");
            if candidate.is_file() {
                return Ok(Self { path: candidate });
            }
        }

        // 4. Hardcoded fallbacks
        for p in FALLBACK_PATHS {
            let candidate = Path::new(p);
            if candidate.is_file() {
                return Ok(Self {
                    path: candidate.to_path_buf(),
                });
            }
        }

        Err(
            "yt-dlp not found. Install it (https://github.com/yt-dlp/yt-dlp) or set YTDLP_PATH."
                .to_string(),
        )
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, MutexGuard, OnceLock};

    /// `find` reads process-wide environment variables, so these tests are serialised.
    fn env_lock() -> MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    /// Restores every variable `find` reads, however the test ends.
    struct EnvGuard {
        ytdlp: Option<String>,
        path: Option<String>,
        home: Option<String>,
        _lock: MutexGuard<'static, ()>,
    }

    impl EnvGuard {
        fn new() -> Self {
            Self {
                ytdlp: std::env::var("YTDLP_PATH").ok(),
                path: std::env::var("PATH").ok(),
                home: std::env::var("HOME").ok(),
                _lock: env_lock(),
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for (key, saved) in [
                ("YTDLP_PATH", &self.ytdlp),
                ("PATH", &self.path),
                ("HOME", &self.home),
            ] {
                match saved {
                    Some(v) => std::env::set_var(key, v),
                    None => std::env::remove_var(key),
                }
            }
        }
    }

    fn fake_binary(dir: &Path) -> PathBuf {
        let path = dir.join("yt-dlp");
        std::fs::write(&path, b"#!/bin/sh\nexit 0\n").unwrap();
        path
    }

    #[test]
    fn prefers_the_explicit_env_var() {
        let _guard = EnvGuard::new();
        let chosen = tempfile::tempdir().unwrap();
        let ignored = tempfile::tempdir().unwrap();
        let expected = fake_binary(chosen.path());
        fake_binary(ignored.path());
        std::env::set_var("YTDLP_PATH", &expected);
        std::env::set_var("PATH", ignored.path());

        assert_eq!(YtDlpBinary::find().unwrap().path(), expected);
    }

    #[test]
    fn ignores_an_env_var_that_points_nowhere() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let expected = fake_binary(dir.path());
        std::env::set_var("YTDLP_PATH", "/nonexistent/yt-dlp");
        std::env::set_var("PATH", dir.path());

        assert_eq!(YtDlpBinary::find().unwrap().path(), expected);
    }

    #[test]
    fn searches_path_in_order() {
        let _guard = EnvGuard::new();
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        let expected = fake_binary(first.path());
        fake_binary(second.path());
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var(
            "PATH",
            format!("{}:{}", first.path().display(), second.path().display()),
        );

        assert_eq!(YtDlpBinary::find().unwrap().path(), expected);
    }

    #[test]
    fn falls_back_to_a_pip_user_install_under_home() {
        let _guard = EnvGuard::new();
        let home = tempfile::tempdir().unwrap();
        let local_bin = home.path().join(".local/bin");
        std::fs::create_dir_all(&local_bin).unwrap();
        let expected = fake_binary(&local_bin);
        let empty = tempfile::tempdir().unwrap();
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var("PATH", empty.path());
        std::env::set_var("HOME", home.path());

        assert_eq!(YtDlpBinary::find().unwrap().path(), expected);
    }

    #[test]
    fn a_directory_named_yt_dlp_does_not_count() {
        let _guard = EnvGuard::new();
        let decoy = tempfile::tempdir().unwrap();
        std::fs::create_dir(decoy.path().join("yt-dlp")).unwrap();
        let real = tempfile::tempdir().unwrap();
        let expected = fake_binary(real.path());
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var(
            "PATH",
            format!("{}:{}", decoy.path().display(), real.path().display()),
        );

        assert_eq!(YtDlpBinary::find().unwrap().path(), expected);
    }

    #[test]
    fn exposes_the_resolved_path() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let binary = fake_binary(dir.path());
        std::env::set_var("YTDLP_PATH", &binary);

        let found = YtDlpBinary::find().unwrap();

        assert!(found.path().ends_with("yt-dlp"));
        assert!(found.path().is_absolute());
    }
}
