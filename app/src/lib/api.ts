import { getServerUrl, getToken } from './config';
import type { PlaylistInfo, Quality, VideoInfo } from '@/types';

async function base(): Promise<string> {
  const url = await getServerUrl();
  if (!url) throw new Error('No server URL set — open Settings and enter your server address.');
  return url;
}

/** Headers every request carries: the server refuses anything without its token. */
export async function authHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

/** `?token=` for the two places a header cannot be set: the WebSocket and the file download. */
async function tokenQuery(): Promise<string> {
  const token = await getToken();
  return token ? `?token=${encodeURIComponent(token)}` : '';
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
  const res = await fetch(`${b}/api/info?${qs.toString()}`, { headers: await authHeaders() });
  if (!res.ok) return asError(res);
  return res.json() as Promise<VideoInfo>;
}

export async function fetchPlaylistInfo(url: string, cookies?: string): Promise<PlaylistInfo> {
  const b = await base();
  const qs = new URLSearchParams({ url });
  if (cookies) qs.set('cookies', cookies);
  const res = await fetch(`${b}/api/playlist?${qs.toString()}`, { headers: await authHeaders() });
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
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return asError(res);
  const json = (await res.json()) as { download_id: string };
  return json.download_id;
}

export async function cancelDownload(id: string): Promise<void> {
  const b = await base();
  await fetch(`${b}/api/download/${id}/cancel`, {
    method: 'POST',
    headers: await authHeaders(),
  }).catch(() => {});
}

/** WebSocket URL streaming `DownloadEvent`s for a given download. */
export async function downloadSocketUrl(id: string): Promise<string> {
  const b = await base();
  return `${b.replace(/^http/i, 'ws')}/api/download/${id}/ws${await tokenQuery()}`;
}

/** Direct download URL for one produced file. */
export async function fileUrl(id: string, filename: string): Promise<string> {
  const b = await base();
  return `${b}/files/${id}/${encodeURIComponent(filename)}${await tokenQuery()}`;
}
