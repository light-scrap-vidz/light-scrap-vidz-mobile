import { getServerUrl, setServerUrl } from '@/lib/config';
import * as api from '@/lib/api';

const fetchMock = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  await setServerUrl('http://server:8787');
});

function ok(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') };
}

function failure(status: number, body = '') {
  return { ok: false, status, json: () => Promise.resolve({}), text: () => Promise.resolve(body) };
}

describe('api — server address', () => {
  it('refuses to call out before a server is configured', async () => {
    await setServerUrl('');
    // getServerUrl caches, so re-read to confirm the guard is hit
    await expect(getServerUrl()).resolves.toBe('');

    await expect(api.fetchVideoInfo('https://a')).rejects.toThrow(/No server URL set/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('api — metadata', () => {
  it('fetches single-video info', async () => {
    fetchMock.mockResolvedValue(ok({ title: 'clip' }));

    await expect(api.fetchVideoInfo('https://youtu.be/a')).resolves.toEqual({ title: 'clip' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://server:8787/api/info?url=https%3A%2F%2Fyoutu.be%2Fa',
    );
  });

  it('passes the cookies browser when given', async () => {
    fetchMock.mockResolvedValue(ok({}));

    await api.fetchVideoInfo('https://youtu.be/a', 'firefox');

    expect(fetchMock.mock.calls[0][0]).toContain('cookies=firefox');
  });

  it('fetches playlist info', async () => {
    fetchMock.mockResolvedValue(ok({ title: 'list' }));

    await expect(api.fetchPlaylistInfo('https://list')).resolves.toEqual({ title: 'list' });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/playlist?');
  });

  it('passes the cookies browser for playlists too', async () => {
    fetchMock.mockResolvedValue(ok({}));

    await api.fetchPlaylistInfo('https://list', 'chrome');

    expect(fetchMock.mock.calls[0][0]).toContain('cookies=chrome');
  });

  it('surfaces the server body as the error message', async () => {
    fetchMock.mockResolvedValue(failure(500, 'yt-dlp exploded'));

    await expect(api.fetchVideoInfo('https://a')).rejects.toThrow('yt-dlp exploded');
  });

  it('falls back to the status code when the body is empty', async () => {
    fetchMock.mockResolvedValue(failure(502));

    await expect(api.fetchVideoInfo('https://a')).rejects.toThrow('Server error 502');
  });

  it('falls back to the status code when the body cannot be read', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.reject(new Error('stream closed')),
    });

    await expect(api.fetchVideoInfo('https://a')).rejects.toThrow('Server error 503');
  });
});

describe('api — downloads', () => {
  const body = {
    url: 'https://youtu.be/a',
    quality: 'best' as const,
    audio_only: false,
    playlist_end: null,
  };

  it('starts a download and returns its id', async () => {
    fetchMock.mockResolvedValue(ok({ download_id: 'dl-1' }));

    await expect(api.startDownload(body)).resolves.toBe('dl-1');
    expect(fetchMock).toHaveBeenCalledWith('http://server:8787/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  it('reports a refused download', async () => {
    fetchMock.mockResolvedValue(failure(400, 'bad url'));

    await expect(api.startDownload(body)).rejects.toThrow('bad url');
  });

  it('cancels a download', async () => {
    fetchMock.mockResolvedValue(ok({}));

    await api.cancelDownload('dl-1');

    expect(fetchMock).toHaveBeenCalledWith('http://server:8787/api/download/dl-1/cancel', {
      method: 'POST',
    });
  });

  it('swallows a failed cancel', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(api.cancelDownload('dl-1')).resolves.toBeUndefined();
  });
});

describe('api — URLs', () => {
  it('turns the server address into a websocket URL', async () => {
    await expect(api.downloadSocketUrl('dl-1')).resolves.toBe(
      'ws://server:8787/api/download/dl-1/ws',
    );
  });

  it('upgrades https to wss', async () => {
    await setServerUrl('https://secure:8787');
    await expect(api.downloadSocketUrl('dl-1')).resolves.toBe(
      'wss://secure:8787/api/download/dl-1/ws',
    );
  });

  it('builds a file URL with the name encoded', async () => {
    await expect(api.fileUrl('dl-1', 'my clip.mp4')).resolves.toBe(
      'http://server:8787/files/dl-1/my%20clip.mp4',
    );
  });
});
