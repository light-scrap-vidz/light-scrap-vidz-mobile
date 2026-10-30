import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import App from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setServerUrl } from '@/lib/config';
import { fetchVideoInfo, fetchPlaylistInfo, startDownload, downloadSocketUrl } from '@/lib/api';
import { saveAllToDevice } from '@/lib/save';
import { notifyDownloadComplete } from '@/lib/notify';

jest.mock('@/lib/api', () => ({
  fetchVideoInfo: jest.fn(),
  fetchPlaylistInfo: jest.fn(),
  startDownload: jest.fn(),
  cancelDownload: jest.fn(),
  downloadSocketUrl: jest.fn(),
}));
jest.mock('@/lib/save', () => ({ saveAllToDevice: jest.fn() }));
jest.mock('@/lib/notify', () => ({ notifyDownloadComplete: jest.fn() }));

const mockVideo = fetchVideoInfo as jest.MockedFunction<typeof fetchVideoInfo>;
const mockPlaylist = fetchPlaylistInfo as jest.MockedFunction<typeof fetchPlaylistInfo>;
const mockStart = startDownload as jest.MockedFunction<typeof startDownload>;
const mockSocketUrl = downloadSocketUrl as jest.MockedFunction<typeof downloadSocketUrl>;
const mockSaveAll = saveAllToDevice as jest.MockedFunction<typeof saveAllToDevice>;
const mockNotify = notifyDownloadComplete as jest.MockedFunction<typeof notifyDownloadComplete>;

class FakeSocket {
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

const videoInfo = {
  id: 'abc',
  title: 'A clip',
  thumbnail: '',
  duration: 30,
  uploader: 'Someone',
} as never;

const playlistInfo = {
  title: 'A playlist',
  playlist_count: 2,
  entries: [
    { url: 'https://youtu.be/a', title: 'First' },
    { url: 'https://youtu.be/b', title: 'Second' },
  ],
} as never;

const urlField = () => screen.getByPlaceholderText('Paste a video link…');

/** Submits a URL and settles the lookup. */
async function fetchUrl(url: string) {
  fireEvent.changeText(urlField(), url);
  await act(async () => {
    fireEvent(urlField(), 'submitEditing');
  });
}

async function renderApp() {
  render(<App />);
  await act(async () => {});
}

beforeEach(async () => {
  jest.clearAllMocks();
  // A download recorded by an earlier test would otherwise show up in the history
  // list and make title queries ambiguous.
  await AsyncStorage.clear();
  (global as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
  await setServerUrl('http://server:8787');
  mockVideo.mockResolvedValue(videoInfo);
  mockPlaylist.mockResolvedValue(playlistInfo);
  mockStart.mockResolvedValue('dl-1');
  mockSocketUrl.mockResolvedValue('ws://server/api/download/dl-1/ws');
  mockSaveAll.mockResolvedValue(undefined);
  mockNotify.mockResolvedValue(undefined);
});

describe('App — home', () => {
  it('shows the URL field and the recent tab', async () => {
    await renderApp();

    expect(urlField()).toBeTruthy();
    expect(screen.getByText('No downloads yet')).toBeTruthy();
  });

  it('switches between the recent and queue tabs', async () => {
    await renderApp();

    fireEvent.press(screen.getByText('Queue'));
    expect(screen.getByPlaceholderText('Paste one or more links, one per line…')).toBeTruthy();

    fireEvent.press(screen.getByText('Recent'));
    expect(screen.getByText('No downloads yet')).toBeTruthy();
  });

  it('nudges the user to set a server when none is configured', async () => {
    await setServerUrl('');
    await renderApp();

    await waitFor(() => expect(screen.getByText(/server/i)).toBeTruthy());
  });
});

describe('App — looking a video up', () => {
  it('fetches a single video and shows its preview', async () => {
    await renderApp();

    await fetchUrl('https://www.youtube.com/watch?v=abc');

    expect(mockVideo).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc', undefined);
    expect(screen.getByText('A clip')).toBeTruthy();
    expect(screen.getByText('Download MP4')).toBeTruthy();
  });

  it('fetches a playlist and lists its entries', async () => {
    await renderApp();

    await fetchUrl('https://www.youtube.com/playlist?list=PL1');

    expect(mockPlaylist).toHaveBeenCalled();
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Download 2 videos')).toBeTruthy();
  });

  it('surfaces a lookup failure', async () => {
    mockVideo.mockRejectedValue(new Error('ERROR: This video is private'));
    await renderApp();

    await fetchUrl('https://youtu.be/abc');

    await waitFor(() => expect(screen.getByText(/This video is private/)).toBeTruthy());
  });
});

describe('App — downloading', () => {
  it('starts a single download and reports progress', async () => {
    await renderApp();
    await fetchUrl('https://www.youtube.com/watch?v=abc');

    await act(async () => {
      fireEvent.press(screen.getByText('Download MP4'));
    });

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.youtube.com/watch?v=abc', quality: 'best' }),
    );

    await act(async () => {
      FakeSocket.last!.emit({ type: 'progress', percent: 40 });
    });
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('honours the audio-only choice', async () => {
    await renderApp();
    await fetchUrl('https://www.youtube.com/watch?v=abc');

    fireEvent.press(screen.getByText('Audio · MP3'));
    await act(async () => {
      fireEvent.press(screen.getByText('Extract MP3'));
    });

    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ audio_only: true }));
  });

  it('records the finished download in the history', async () => {
    await renderApp();
    await fetchUrl('https://www.youtube.com/watch?v=abc');
    await act(async () => {
      fireEvent.press(screen.getByText('Download MP4'));
    });

    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['clip.mp4'] });
    });

    await waitFor(() => expect(screen.getByText('Saved to device')).toBeTruthy());
  });

  it('offers another download once finished', async () => {
    await renderApp();
    await fetchUrl('https://www.youtube.com/watch?v=abc');
    await act(async () => {
      fireEvent.press(screen.getByText('Download MP4'));
    });
    await act(async () => {
      FakeSocket.last!.emit({ type: 'complete', files: ['clip.mp4'] });
    });
    await waitFor(() => expect(screen.getByText('Download another')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Download another'));
    });

    expect(screen.getByText('A clip')).toBeTruthy();
  });
});

describe('App — playlists', () => {
  it('queues the hand-picked entries instead of downloading straight away', async () => {
    await renderApp();
    await fetchUrl('https://www.youtube.com/playlist?list=PL1');

    fireEvent.press(screen.getByText('First'));
    await act(async () => {
      fireEvent.press(screen.getByText('Download 1 selected'));
    });

    await waitFor(() =>
      expect(mockStart).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://youtu.be/a' }),
      ),
    );
  });

  it('honours the chosen count for a whole-playlist download', async () => {
    await renderApp();
    await fetchUrl('https://www.youtube.com/playlist?list=PL1');

    fireEvent.press(screen.getByText('25'));
    await act(async () => {
      fireEvent.press(screen.getByText('Download 2 videos'));
    });

    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ playlist_end: 25 }));
  });
});

describe('App — queue tab', () => {
  it('adds pasted links and starts working through them', async () => {
    await renderApp();
    fireEvent.press(screen.getByText('Queue'));

    const box = screen.getByPlaceholderText('Paste one or more links, one per line…');
    fireEvent.changeText(box, 'https://youtu.be/a\nhttps://youtu.be/b');
    await act(async () => {
      fireEvent.press(screen.getByText('Add to queue'));
    });

    await waitFor(() =>
      expect(mockStart).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://youtu.be/a' }),
      ),
    );
  });
});

describe('App — settings', () => {
  it('keeps the settings sheet closed until asked', async () => {
    await renderApp();
    expect(screen.queryByText('Test connection')).toBeNull();
  });
});
