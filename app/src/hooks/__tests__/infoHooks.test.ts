import { renderHook, act } from '@testing-library/react-native';
import { fetchVideoInfo, fetchPlaylistInfo } from '@/lib/api';
import { useVideoInfo } from '@/hooks/useVideoInfo';
import { usePlaylistInfo } from '@/hooks/usePlaylistInfo';

jest.mock('@/lib/api', () => ({
  fetchVideoInfo: jest.fn(),
  fetchPlaylistInfo: jest.fn(),
}));

const mockVideo = fetchVideoInfo as jest.MockedFunction<typeof fetchVideoInfo>;
const mockPlaylist = fetchPlaylistInfo as jest.MockedFunction<typeof fetchPlaylistInfo>;

const videoInfo = { id: 'a', title: 'A clip' } as never;
const playlistInfo = { title: 'A playlist', entries: [] } as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useVideoInfo', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useVideoInfo());
    expect(result.current.status).toBe('idle');
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('loads a video and hands it back to the caller', async () => {
    mockVideo.mockResolvedValue(videoInfo);
    const { result } = renderHook(() => useVideoInfo());

    let returned;
    await act(async () => {
      returned = await result.current.fetchInfo('https://youtu.be/a');
    });

    expect(returned).toBe(videoInfo);
    expect(result.current.status).toBe('success');
    expect(result.current.info).toBe(videoInfo);
    expect(mockVideo).toHaveBeenCalledWith('https://youtu.be/a', undefined);
  });

  it('forwards the cookies browser', async () => {
    mockVideo.mockResolvedValue(videoInfo);
    const { result } = renderHook(() => useVideoInfo());

    await act(async () => {
      await result.current.fetchInfo('https://youtu.be/a', 'firefox');
    });

    expect(mockVideo).toHaveBeenCalledWith('https://youtu.be/a', 'firefox');
  });

  it('turns a backend failure into a friendly message', async () => {
    mockVideo.mockRejectedValue(new Error('ERROR: This video is private'));
    const { result } = renderHook(() => useVideoInfo());

    let returned;
    await act(async () => {
      returned = await result.current.fetchInfo('https://youtu.be/a');
    });

    expect(returned).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('This video is private');
  });

  it('stringifies a non-Error rejection', async () => {
    mockVideo.mockRejectedValue('plain failure');
    const { result } = renderHook(() => useVideoInfo());

    await act(async () => {
      await result.current.fetchInfo('https://youtu.be/a');
    });

    expect(result.current.error).toBeTruthy();
  });

  it('drops the previous result when a new fetch starts', async () => {
    mockVideo.mockResolvedValue(videoInfo);
    const { result } = renderHook(() => useVideoInfo());
    await act(async () => {
      await result.current.fetchInfo('https://youtu.be/a');
    });

    mockVideo.mockRejectedValue(new Error('nope'));
    await act(async () => {
      await result.current.fetchInfo('https://youtu.be/b');
    });

    expect(result.current.info).toBeNull();
  });

  it('reset returns it to its initial state', async () => {
    mockVideo.mockResolvedValue(videoInfo);
    const { result } = renderHook(() => useVideoInfo());
    await act(async () => {
      await result.current.fetchInfo('https://youtu.be/a');
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('usePlaylistInfo', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => usePlaylistInfo());
    expect(result.current.status).toBe('idle');
    expect(result.current.info).toBeNull();
  });

  it('loads a playlist', async () => {
    mockPlaylist.mockResolvedValue(playlistInfo);
    const { result } = renderHook(() => usePlaylistInfo());

    let returned;
    await act(async () => {
      returned = await result.current.fetchInfo('https://list');
    });

    expect(returned).toBe(playlistInfo);
    expect(result.current.status).toBe('success');
  });

  it('forwards the cookies browser', async () => {
    mockPlaylist.mockResolvedValue(playlistInfo);
    const { result } = renderHook(() => usePlaylistInfo());

    await act(async () => {
      await result.current.fetchInfo('https://list', 'chrome');
    });

    expect(mockPlaylist).toHaveBeenCalledWith('https://list', 'chrome');
  });

  it('reports a failure and returns null', async () => {
    mockPlaylist.mockRejectedValue(new Error('ERROR: playlist is private'));
    const { result } = renderHook(() => usePlaylistInfo());

    let returned;
    await act(async () => {
      returned = await result.current.fetchInfo('https://list');
    });

    expect(returned).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeTruthy();
  });

  it('reset returns it to its initial state', async () => {
    mockPlaylist.mockResolvedValue(playlistInfo);
    const { result } = renderHook(() => usePlaylistInfo());
    await act(async () => {
      await result.current.fetchInfo('https://list');
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.info).toBeNull();
  });
});
