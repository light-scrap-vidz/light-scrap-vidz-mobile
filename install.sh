#!/usr/bin/env bash
# light-scrap-vidz mobile server — one-line installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/light-scrap-vidz/light-scrap-vidz-mobile/main/install.sh | bash
#
# Installs the self-hosted server the mobile app talks to, into ~/.local/bin.
# The Android app itself is installed from the APK attached to each release.
#
# Re-run the same command to upgrade an existing install.
set -eo pipefail

REPO="light-scrap-vidz/light-scrap-vidz-mobile"
BIN="light-scrap-vidz-server"
RUNTIME_DEPS="yt-dlp ffmpeg"

log() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# fetch <url> [output] — writes to <output>, or to stdout when omitted
fetch() {
  if command -v curl >/dev/null 2>&1; then
    if [ $# -ge 2 ]; then curl -fsSL "$1" -o "$2"; else curl -fsSL "$1"; fi
  elif command -v wget >/dev/null 2>&1; then
    if [ $# -ge 2 ]; then wget -qO "$2" "$1"; else wget -qO- "$1"; fi
  else
    die "curl or wget is required"
  fi
}

# latest_asset <filename> — download URL of that asset in the latest release
latest_asset() {
  fetch "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o "\"browser_download_url\": *\"[^\"]*/$1\"" \
    | head -1 \
    | sed 's/.*"\(https[^"]*\)"/\1/'
}

install_runtime_deps() {
  missing=""
  for dep in $RUNTIME_DEPS; do
    command -v "$dep" >/dev/null 2>&1 || missing="$missing $dep"
  done
  [ -n "$missing" ] || return 0
  log "Installing runtime dependencies:$missing"
  if command -v brew >/dev/null 2>&1; then
    brew install $missing
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y $missing
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y $missing
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm $missing
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper install -y $missing
  else
    log "No supported package manager found — install these manually:$missing"
  fi
}

echo "$BIN installer"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)  platform="macos-arm64" ;;
  Linux-x86_64)  platform="linux-x86_64" ;;
  *) die "Unsupported platform: $(uname -s) $(uname -m). Build from source — see server/ in https://github.com/$REPO" ;;
esac

install_runtime_deps

archive="$BIN-$platform.tar.gz"
url="$(latest_asset "$archive")"
[ -n "$url" ] || die "No $archive in the latest release — see https://github.com/$REPO/releases"

bin_dir="$HOME/.local/bin"
mkdir -p "$bin_dir"
tmp="$(mktemp -d)"

log "Downloading $archive…"
fetch "$url" "$tmp/$archive"
tar -xzf "$tmp/$archive" -C "$tmp"
install -m 755 "$tmp/$BIN-$platform/$BIN" "$bin_dir/$BIN"
rm -rf "$tmp"

case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) log "Note: $bin_dir is not in your PATH — add it to your shell profile." ;;
esac

log "Done. Start the server with: $bin_dir/$BIN"
log "It listens on 0.0.0.0:8787 — point the mobile app's Settings at http://<this-machine-ip>:8787"
