# Stage 1 — compile the Rust binary
FROM rust:1.85-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

# Stage 2 — minimal runtime image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/light-scrap-vidz-server /usr/local/bin/

ENV PORT=8080
EXPOSE 8080
CMD ["light-scrap-vidz-server"]
