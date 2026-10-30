import { renderHook, act, waitFor } from '@testing-library/react-native';
import { startDownload, downloadSocketUrl } from '@/lib/api';
import { saveAllToDevice } from '@/lib/save';
import { useQueue } from '@/hooks/useQueue';

jest.mock('@/lib/api', () => ({ startDownload: jest.fn(), downloadSocketUrl: jest.fn() }));
jest.mock('@/lib/save', () => ({ saveAllToDevice: jest.fn() }));

const mockStart = startDownload as jest.MockedFunction<typeof startDownload>;
const mockSocketUrl = downloadSocketUrl as jest.MockedFunction<typeof downloadSocketUrl>;
const mockSaveAll = saveAllToDevice as jest.MockedFunction<typeof saveAllToDevice>;

class FakeSocket {
  /** The most recently opened socket, so tests can push events at it. */
  static last: FakeSocket | null = null;

  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
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

const config = (url: string) =>
  ({ url, quality: 'best', audioOnly: false, playlistEnd: null }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  (global as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
  mockStart.mockResolvedValue('dl-1');
  mockSocketUrl.mockResolvedValue('ws://server/api/download/dl-1/ws');
  mockSaveAll.mockResolvedValue(undefined);
});

/** Queues the given URLs and waits for the first to start downloading. */
async function queue(hook: { current: ReturnType<typeof useQueue> }, urls: string[]) {
  await act(async () => {
    hook.current.addItems(urls.map(config));
  });
  await waitFor(() => expect(hook.current.items[0].status).toBe('downloading'));
}

describe('useQueue — initial state', () => {
  it('starts empty and inactive', () => {
    const { result } = renderHook(() => useQueue());
    expect(result.current.items).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });
});

describe('useQueue — processing', () => {
  it('queues items and starts the first', async () => {
    const { result } = renderHook(() => useQueue());

    await queue(result, ['https://a', 'https://b']);

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[1].status).toBe('pending');
    expect(result.current.isActive).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('gives each queued item a distinct id', async () => {
    const { result } = renderHook(() => useQueue());

    await queue(result, ['https://a', 'https://b']);

    expect(result.current.items[0].id).not.toBe(result.current.items[1].id);
  });

  it('tracks progress on the running item', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'progress', percent: 55 });
    });

    expect(result.current.items[0].progress).toBe(55);
  });

  it('ignores a malformed frame', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    await act(async () => {
      FakeSocket.last!.onmessage?.({ data: 'not json' });
    });

    expect(result.current.items[0].status).toBe('downloading');
  });

  it('marks an item done and moves to the next', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a', 'https://b']);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['a.mp4'] });
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('done'));
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));
  });

  it('becomes inactive once everything has finished', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['a.mp4'] });
    });

    await waitFor(() => expect(result.current.isActive).toBe(false));
  });
});

describe('useQueue — failures', () => {
  it('marks the item failed when the server refuses to start', async () => {
    mockStart.mockRejectedValue(new Error('ERROR: This video is private'));
    const { result } = renderHook(() => useQueue());

    await act(async () => {
      result.current.addItems([config('https://a')]);
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toContain('This video is private');
  });

  it('records a server error frame', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'error', message: 'ERROR: This video is unavailable' });
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toContain('unavailable');
  });

  it('records a dropped connection', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    await act(async () => {
      FakeSocket.last!.onerror?.();
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toContain('Lost connection');
  });

  it('records a failure to save the produced files', async () => {
    mockSaveAll.mockRejectedValue(new Error('storage full'));
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['a.mp4'] });
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toContain('storage full');
  });

  it('keeps draining the queue after a failure', async () => {
    mockStart.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useQueue());

    await act(async () => {
      result.current.addItems([config('https://a'), config('https://b')]);
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));
  });
});

describe('useQueue — pruning', () => {
  it('removes a pending item', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a', 'https://b']);
    const pendingId = result.current.items[1].id;

    act(() => result.current.removeItem(pendingId));

    expect(result.current.items.map((i) => i.url)).toEqual(['https://a']);
  });

  it('refuses to remove the item being downloaded', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    act(() => result.current.removeItem(result.current.items[0].id));

    expect(result.current.items).toHaveLength(1);
  });

  it('clearDone keeps what is still pending or running', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a', 'https://b']);
    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['a.mp4'] });
    });
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));

    act(() => result.current.clearDone());

    expect(result.current.items.map((i) => i.url)).toEqual(['https://b']);
  });

  it('clearAll keeps only the running item', async () => {
    const { result } = renderHook(() => useQueue());
    await queue(result, ['https://a', 'https://b']);

    act(() => result.current.clearAll());

    expect(result.current.items.map((i) => i.url)).toEqual(['https://a']);
  });
});

describe('useQueue — teardown', () => {
  it('closes the socket when unmounted', async () => {
    const { result, unmount } = renderHook(() => useQueue());
    await queue(result, ['https://a']);

    unmount();

    expect(FakeSocket.last!.closed).toBe(true);
  });
});
