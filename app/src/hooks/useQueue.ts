import { useState, useCallback, useRef, useEffect } from 'react';
import { startDownload, downloadSocketUrl } from '@/lib/api';
import { saveAllToDevice } from '@/lib/save';
import { parseYtdlpError } from '@/lib/error-parser';
import type { DownloadEvent, QueueItem } from '@/types';

type QueueConfig = Omit<QueueItem, 'id' | 'status' | 'error' | 'progress'>;

interface UseQueueReturn {
  items: QueueItem[];
  isActive: boolean;
  addItems: (configs: QueueConfig[]) => void;
  removeItem: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
}

let seq = 0;
function localId(): string {
  seq += 1;
  return `q_${new Date().getTime()}_${seq}`;
}

export function useQueue(): UseQueueReturn {
  const [items, setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }
  }, []);

  useEffect(() => () => closeSocket(), [closeSocket]);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    const next = itemsRef.current.find((i) => i.status === 'pending');
    if (!next) return;

    processingRef.current = true;
    setItems((prev) =>
      prev.map((i) => (i.id === next.id ? { ...i, status: 'downloading' as const } : i)),
    );

    const finish = (status: 'done' | 'error', error?: string) => {
      setItems((prev) =>
        prev.map((i) => (i.id === next.id ? { ...i, status, error, progress: undefined } : i)),
      );
      processingRef.current = false;
      closeSocket();
      setTimeout(() => {
        void processNext();
      }, 50);
    };

    let serverId: string;
    try {
      serverId = await startDownload({
        url: next.url,
        quality: next.quality,
        audio_only: next.audioOnly,
        playlist_end: next.playlistEnd,
        cookies: null,
      });
    } catch (err) {
      finish('error', parseYtdlpError(err instanceof Error ? err.message : String(err)));
      return;
    }

    const wsUrl = await downloadSocketUrl(serverId);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      let ev: DownloadEvent;
      try {
        ev = JSON.parse(event.data as string) as DownloadEvent;
      } catch {
        return;
      }
      if (ev.type === 'progress') {
        const percent = ev.percent;
        setItems((prev) => prev.map((i) => (i.id === next.id ? { ...i, progress: percent } : i)));
      } else if (ev.type === 'complete') {
        saveAllToDevice(serverId, ev.files)
          .then(() => finish('done'))
          .catch((err) =>
            finish('error', err instanceof Error ? err.message : 'Failed to save file.'),
          );
      } else if (ev.type === 'error') {
        finish('error', parseYtdlpError(ev.message));
      }
    };

    socket.onerror = () => {
      finish('error', 'Lost connection to the server.');
    };
  }, [closeSocket]);

  const addItems = useCallback(
    (configs: QueueConfig[]) => {
      const queued: QueueItem[] = configs.map((c) => ({
        ...c,
        id: localId(),
        status: 'pending' as const,
      }));
      setItems((prev) => {
        const updated = [...prev, ...queued];
        itemsRef.current = updated;
        return updated;
      });
      setTimeout(() => {
        void processNext();
      }, 50);
    },
    [processNext],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id || i.status === 'downloading'));
  }, []);

  const clearDone = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === 'pending' || i.status === 'downloading'));
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === 'downloading'));
  }, []);

  const isActive = items.some((i) => i.status === 'pending' || i.status === 'downloading');

  return { items, isActive, addItems, removeItem, clearDone, clearAll };
}

export type { QueueConfig };
