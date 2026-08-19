import { useState, useCallback } from 'react';
import { fetchVideoInfo } from '@/lib/api';
import { parseYtdlpError } from '@/lib/error-parser';
import type { VideoInfo } from '@/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface UseVideoInfoReturn {
  info: VideoInfo | null;
  status: Status;
  error: string | null;
  fetchInfo: (url: string, cookies?: string) => Promise<VideoInfo | null>;
  reset: () => void;
}

export function useVideoInfo(): UseVideoInfoReturn {
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(
    async (url: string, cookies?: string): Promise<VideoInfo | null> => {
      setStatus('loading');
      setError(null);
      setInfo(null);
      try {
        const data = await fetchVideoInfo(url, cookies);
        setInfo(data);
        setStatus('success');
        return data;
      } catch (err) {
        setError(parseYtdlpError(err instanceof Error ? err.message : String(err)));
        setStatus('error');
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setInfo(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { info, status, error, fetchInfo, reset };
}
