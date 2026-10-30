# Stage 1 — compile the Rust binary
FROM rust:1.96-slim-bookworm AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

# Stage 2 — minimal runtime image
FROM debian:bookworm-slim
# Pinned so two builds of the same commit ship the same yt-dlp (bump on purpose).
ARG YTDLP_VERSION=2026.10.21
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir "yt-dlp==${YTDLP_VERSION}" --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/light-scrap-vidz-server /usr/local/bin/

RUN useradd --system --create-home app
USER app

# Set AUTH_TOKEN at run time (fly secrets set AUTH_TOKEN=...); without it a random token is
# generated and printed in the logs at each start.
ENV PORT=8080
EXPOSE 8080
CMD ["light-scrap-vidz-server"]
