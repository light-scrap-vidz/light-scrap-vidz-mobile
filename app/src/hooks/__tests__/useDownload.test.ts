import { renderHook, act, waitFor } from '@testing-library/react-native';
import { startDownload, cancelDownload, downloadSocketUrl } from '@/lib/api';
import { saveAllToDevice } from '@/lib/save';
import { notifyDownloadComplete } from '@/lib/notify';
import { useDownload } from '@/hooks/useDownload';

jest.mock('@/lib/api', () => ({
  startDownload: jest.fn(),
  cancelDownload: jest.fn(),
  downloadSocketUrl: jest.fn(),
}));
jest.mock('@/lib/save', () => ({ saveAllToDevice: jest.fn() }));
jest.mock('@/lib/notify', () => ({ notifyDownloadComplete: jest.fn() }));

const mockStart = startDownload as jest.MockedFunction<typeof startDownload>;
const mockCancel = cancelDownload as jest.MockedFunction<typeof cancelDownload>;
const mockSocketUrl = downloadSocketUrl as jest.MockedFunction<typeof downloadSocketUrl>;
const mockSaveAll = saveAllToDevice as jest.MockedFunction<typeof saveAllToDevice>;
const mockNotify = notifyDownloadComplete as jest.MockedFunction<typeof notifyDownloadComplete>;

/** The last socket the hook opened, so tests can push events at it. */
class FakeSocket {
  /** The most recently opened socket, so tests can push events at it. */
  static last: FakeSocket | null = null;

  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeSocket.last = this;
  }

  close() {
    this.closed = true;
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const args: Record<string, unknown> = {
  url: 'https://www.youtube.com/watch?v=abc',
  quality: 'best' as const,
  audioOnly: false,
  playlistEnd: null,
  info: { title: 'A clip', thumbnail: 'https://img/t.jpg' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (global as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
  mockStart.mockResolvedValue('dl-1');
  mockSocketUrl.mockResolvedValue('ws://server/api/download/dl-1/ws');
  mockSaveAll.mockResolvedValue(undefined);
  mockNotify.mockResolvedValue(undefined);
});

/** Starts a download and waits for the socket to be wired. */
async function start(
  hook: { current: ReturnType<typeof useDownload> },
  over: Record<string, unknown> = {},
) {
  await act(async () => {
    await hook.current.download({ ...args, ...over } as never);
  });
}

describe('useDownload — lifecycle', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useDownload());
    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBeNull();
    expect(result.current.completedFiles).toEqual([]);
    expect(result.current.downloadId).toBeNull();
  });

  it('asks the server to start and remembers the id', async () => {
    const { result } = renderHook(() => useDownload());

    await start(result);

    expect(mockStart).toHaveBeenCalledWith({
      url: args.url as string,
      quality: 'best',
      audio_only: false,
      playlist_end: null,
      cookies: null,
    });
    expect(result.current.downloadId).toBe('dl-1');
    expect(result.current.status).toBe('downloading');
  });

  it('opens the websocket the server pointed at', async () => {
    const { result } = renderHook(() => useDownload());

    await start(result);

    expect(FakeSocket.last!.url).toBe('ws://server/api/download/dl-1/ws');
  });

  it('reports a refused start without opening a socket', async () => {
    mockStart.mockRejectedValue(new Error('ERROR: This video is private'));
    const { result } = renderHook(() => useDownload());

    await start(result);

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('This video is private');
    expect(mockSocketUrl).not.toHaveBeenCalled();
  });
});

describe('useDownload — progress', () => {
  it('records the reported progress', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'progress', percent: 42, speed: '1MiB/s', eta: '10s' });
    });

    expect(result.current.progress?.percent).toBe(42);
    expect(result.current.progress?.speed).toBe('1MiB/s');
  });

  it('ignores a malformed frame', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      FakeSocket.last!.onmessage?.({ data: 'not json' });
    });

    expect(result.current.progress).toBeNull();
    expect(result.current.status).toBe('downloading');
  });
});

describe('useDownload — completion', () => {
  it('saves the files, notifies and finishes', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['clip.mp4'] });
    });

    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(mockSaveAll).toHaveBeenCalledWith('dl-1', ['clip.mp4']);
    expect(mockNotify).toHaveBeenCalledWith('A clip');
    expect(result.current.completedFiles).toEqual(['clip.mp4']);
  });

  it('records the download in the history', async () => {
    const addHistoryEntry = jest.fn();
    const { result } = renderHook(() => useDownload(addHistoryEntry));
    await start(result);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['clip.mp4'] });
    });

    await waitFor(() => expect(addHistoryEntry).toHaveBeenCalled());
    expect(addHistoryEntry.mock.calls[0][0]).toMatchObject({
      id: 'dl-1',
      title: 'A clip',
      platform: 'youtube',
      filename: 'clip.mp4',
      quality: 'best',
    });
  });

  it('prefers the playlist title when there is one', async () => {
    const addHistoryEntry = jest.fn();
    const { result } = renderHook(() => useDownload(addHistoryEntry));
    await start(result, { playlistInfo: { title: 'A playlist' } });

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['a.mp4', 'b.mp4'] });
    });

    await waitFor(() => expect(addHistoryEntry).toHaveBeenCalled());
    expect(addHistoryEntry.mock.calls[0][0].title).toBe('A playlist');
  });

  it('falls back to the first file name when nothing is known', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result, { info: undefined });

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['fallback.mp4'] });
    });

    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('fallback.mp4'));
  });

  it('reports a failure to save to the device', async () => {
    mockSaveAll.mockRejectedValue(new Error('storage full'));
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['clip.mp4'] });
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toContain('storage full');
  });
});

describe('useDownload — failures', () => {
  it('turns a server error frame into a friendly message', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'error', message: 'ERROR: This video is private' });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('This video is private');
  });

  it('reports a dropped connection', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      FakeSocket.last!.onerror?.();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Lost connection');
  });

  it('does not let a late socket error overwrite a finished download', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);
    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['clip.mp4'] });
    });
    await waitFor(() => expect(result.current.status).toBe('complete'));

    await act(async () => {
      FakeSocket.last!.onerror?.();
    });

    expect(result.current.status).toBe('complete');
  });
});

describe('useDownload — cancel and reset', () => {
  it('cancels on the server and closes the socket', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockCancel).toHaveBeenCalledWith('dl-1');
    expect(result.current.status).toBe('cancelled');
    expect(FakeSocket.last!.closed).toBe(true);
  });

  it('cancelling before any download only flips the status', async () => {
    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockCancel).not.toHaveBeenCalled();
    expect(result.current.status).toBe('cancelled');
  });

  it('reset clears every field', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);
    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['clip.mp4'] });
    });
    await waitFor(() => expect(result.current.status).toBe('complete'));

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBeNull();
    expect(result.current.completedFiles).toEqual([]);
    expect(result.current.downloadId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('closes the socket when unmounted', async () => {
    const { result, unmount } = renderHook(() => useDownload());
    await start(result);

    unmount();

    expect(FakeSocket.last!.closed).toBe(true);
  });
});
