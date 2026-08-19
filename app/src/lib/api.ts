import { getServerUrl } from './config';
import type { PlaylistInfo, Quality, VideoInfo } from '@/types';

async function base(): Promise<string> {
  const url = await getServerUrl();
  if (!url) throw new Error('No server URL set — open Settings and enter your server address.');
  return url;
}

async function asError(res: Response): Promise<never> {
  let body = '';
  try {
    body = await res.text();
  } catch {
    // ignore
  }
  throw new Error(body || `Server error ${res.status}`);
}

export async function fetchVideoInfo(url: string, cookies?: string): Promise<VideoInfo> {
  const b = await base();
  const qs = new URLSearchParams({ url });
  if (cookies) qs.set('cookies', cookies);
  const res = await fetch(`${b}/api/info?${qs.toString()}`);
  if (!res.ok) return asError(res);
  return res.json() as Promise<VideoInfo>;
}

export async function fetchPlaylistInfo(url: string, cookies?: string): Promise<PlaylistInfo> {
  const b = await base();
  const qs = new URLSearchParams({ url });
  if (cookies) qs.set('cookies', cookies);
  const res = await fetch(`${b}/api/playlist?${qs.toString()}`);
  if (!res.ok) return asError(res);
  return res.json() as Promise<PlaylistInfo>;
}

export interface StartDownloadBody {
  url: string;
  quality: Quality;
  audio_only: boolean;
  playlist_end: number | null;
  cookies?: string | null;
}

/** Starts a server-side download and returns its id. */
export async function startDownload(body: StartDownloadBody): Promise<string> {
  const b = await base();
  const res = await fetch(`${b}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return asError(res);
  const json = (await res.json()) as { download_id: string };
  return json.download_id;
}

export async function cancelDownload(id: string): Promise<void> {
  const b = await base();
  await fetch(`${b}/api/download/${id}/cancel`, { method: 'POST' }).catch(() => {});
}

/** WebSocket URL streaming `DownloadEvent`s for a given download. */
export async function downloadSocketUrl(id: string): Promise<string> {
  const b = await base();
  return `${b.replace(/^http/i, 'ws')}/api/download/${id}/ws`;
}

/** Direct download URL for one produced file. */
export async function fileUrl(id: string, filename: string): Promise<string> {
  const b = await base();
  return `${b}/files/${id}/${encodeURIComponent(filename)}`;
}
