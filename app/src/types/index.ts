export type Platform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'dailymotion'
  | 'twitter'
  | 'twitch'
  | 'vimeo'
  | 'unknown';

export type Quality = 'best' | '1080p' | '720p' | '480p';

export type DownloadStatus = 'idle' | 'downloading' | 'saving' | 'complete' | 'error' | 'cancelled';

export type UrlKind = 'single' | 'playlist';

export interface VideoFormat {
  format_id: string;
  ext: string;
  height: number | null;
  filesize: number | null;
  vcodec: string | null;
  acodec: string | null;
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  webpage_url: string;
  extractor: string;
  formats: VideoFormat[];
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
}

export interface PlaylistInfo {
  kind: string;
  title: string;
  uploader: string;
  playlist_count: number | null;
  entries: PlaylistEntry[];
}

/** Progress payload mirrored from the server's WebSocket `progress` event. */
export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  filename: string;
  current_item: number | null;
  total_items: number | null;
}

/** Tagged events streamed by the server over the download WebSocket. */
export type DownloadEvent =
  | ({ type: 'progress' } & DownloadProgress)
  | { type: 'complete'; files: string[] }
  | { type: 'error'; message: string };

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  platform: Platform;
  filename: string;
  downloaded_at: number;
  quality: Quality;
}

export interface QueueItem {
  id: string;
  url: string;
  quality: Quality;
  audioOnly: boolean;
  playlistEnd: number | null;
  status: 'pending' | 'downloading' | 'done' | 'error';
  error?: string;
  progress?: number;
}
