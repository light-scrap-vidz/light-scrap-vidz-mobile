import { useState, useCallback, useRef, useEffect } from 'react';
import { startDownload, cancelDownload, downloadSocketUrl } from '@/lib/api';
import { saveAllToDevice } from '@/lib/save';
import { notifyDownloadComplete } from '@/lib/notify';
import { parseYtdlpError } from '@/lib/error-parser';
import { getPlatform } from '@/lib/url-validator';
import type {
  DownloadStatus,
  DownloadProgress,
  DownloadEvent,
  HistoryEntry,
  Quality,
  VideoInfo,
  PlaylistInfo,
} from '@/types';

interface DownloadArgs {
  url: string;
  quality: Quality;
  info: VideoInfo | null;
  playlistInfo: PlaylistInfo | null;
  playlistEnd: number | null;
  audioOnly: boolean;
  cookies?: string;
}

interface UseDownloadReturn {
  status: DownloadStatus;
  progress: DownloadProgress | null;
  completedFiles: string[];
  downloadId: string | null;
  error: string | null;
  download: (args: DownloadArgs) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

function makeNow(): number {
  return new Date().getTime();
}

export function useDownload(addHistoryEntry?: (entry: HistoryEntry) => void): UseDownloadReturn {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [completedFiles, setCompletedFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const idRef = useRef<string | null>(null);
  // True once the download reached a terminal state, so a late socket error
  // (e.g. the server closing the socket on completion) can't override it.
  const settledRef = useRef(false);

  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }
  }, []);

  useEffect(() => () => closeSocket(), [closeSocket]);

  const download = useCallback(
    async (args: DownloadArgs) => {
      closeSocket();
      settledRef.current = false;
      setStatus('downloading');
      setProgress(null);
      setError(null);
      setCompletedFiles([]);

      let id: string;
      try {
        id = await startDownload({
          url: args.url,
          quality: args.quality,
          audio_only: args.audioOnly,
          playlist_end: args.playlistEnd,
          cookies: args.cookies ?? null,
        });
      } catch (err) {
        setStatus('error');
        setError(parseYtdlpError(err instanceof Error ? err.message : String(err)));
        return;
      }

      idRef.current = id;
      setDownloadId(id);

      const onComplete = async (files: string[]) => {
        settledRef.current = true;
        setCompletedFiles(files);
        setStatus('saving');
        try {
          await saveAllToDevice(id, files);
        } catch (err) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Failed to save file to device.');
          return;
        }
        setStatus('complete');

        const title = args.playlistInfo?.title || args.info?.title || files[0] || 'Download';
        void notifyDownloadComplete(title);

        if (addHistoryEntry) {
          addHistoryEntry({
            id,
            url: args.url,
            title,
            thumbnail: args.info?.thumbnail ?? '',
            platform: getPlatform(args.url),
            filename: files[0] ?? '',
            downloaded_at: makeNow(),
            quality: args.quality,
          });
        }
      };

      const wsUrl = await downloadSocketUrl(id);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        if (idRef.current !== id) return;
        let ev: DownloadEvent;
        try {
          ev = JSON.parse(event.data as string) as DownloadEvent;
        } catch {
          return;
        }
        if (ev.type === 'progress') {
          setProgress({
            percent: ev.percent,
            speed: ev.speed,
            eta: ev.eta,
            filename: ev.filename,
            current_item: ev.current_item,
            total_items: ev.total_items,
          });
        } else if (ev.type === 'complete') {
          void onComplete(ev.files);
        } else if (ev.type === 'error') {
          settledRef.current = true;
          setStatus('error');
          setError(parseYtdlpError(ev.message));
        }
      };

      socket.onerror = () => {
        if (idRef.current === id && !settledRef.current) {
          settledRef.current = true;
          setStatus('error');
          setError('Lost connection to the server during download.');
        }
      };
    },
    [closeSocket, addHistoryEntry],
  );

  const cancel = useCallback(async () => {
    settledRef.current = true;
    closeSocket();
    if (idRef.current) {
      await cancelDownload(idRef.current);
    }
    setStatus('cancelled');
  }, [closeSocket]);

  const reset = useCallback(() => {
    closeSocket();
    idRef.current = null;
    setStatus('idle');
    setProgress(null);
    setCompletedFiles([]);
    setError(null);
    setDownloadId(null);
  }, [closeSocket]);

  return { status, progress, completedFiles, downloadId, error, download, cancel, reset };
}
