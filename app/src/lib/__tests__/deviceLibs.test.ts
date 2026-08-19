import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { PLATFORM_META, PLATFORM_TINT } from '@/lib/platform';
import { setServerUrl } from '@/lib/config';
import { notifyDownloadComplete } from '@/lib/notify';
import { saveFileToDevice, saveAllToDevice } from '@/lib/save';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: jest.fn(),
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const mockNotif = Notifications as jest.Mocked<typeof Notifications>;
const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockMedia = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const mockSharing = Sharing as jest.Mocked<typeof Sharing>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('platform metadata', () => {
  const platforms = Object.keys(PLATFORM_META) as (keyof typeof PLATFORM_META)[];

  it('covers the same platforms as the tint table', () => {
    expect(Object.keys(PLATFORM_TINT).sort()).toEqual(platforms.sort());
  });

  it('gives every platform a label and three colours', () => {
    for (const p of platforms) {
      expect(PLATFORM_META[p].label).toBeTruthy();
      expect(PLATFORM_META[p].color).toMatch(/^#|rgba/);
      expect(PLATFORM_META[p].bgColor).toMatch(/^#|rgba/);
      expect(PLATFORM_META[p].borderColor).toMatch(/^#|rgba/);
    }
  });

  it('labels the unknown platform neutrally', () => {
    expect(PLATFORM_META.unknown.label).toBe('Link');
  });
});

describe('notifyDownloadComplete', () => {
  async function notify(title = 'clip.mp4') {
    await notifyDownloadComplete(title);
  }

  it('posts a notification when permission is already granted', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ granted: true } as never);

    await notify('my clip');

    expect(mockNotif.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Download complete', body: 'my clip' },
      trigger: null,
    });
  });

  it('installs the notification handler at most once', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ granted: true } as never);

    await notifyDownloadComplete('a');
    await notifyDownloadComplete('b');

    // The module memoises the handler, so two calls never register it twice.
    expect(mockNotif.setNotificationHandler.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('asks for permission when it has not been granted', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    mockNotif.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);

    await notify();

    expect(mockNotif.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockNotif.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('stays silent when permission is refused', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    mockNotif.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);

    await notify();

    expect(mockNotif.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never throws when the notification stack fails', async () => {
    mockNotif.getPermissionsAsync.mockRejectedValue(new Error('no notifier'));

    await expect(notify()).resolves.toBeUndefined();
  });
});

describe('saveFileToDevice', () => {
  async function save(filename: string) {
    await setServerUrl('http://server:8787');
    return saveFileToDevice('dl-1', filename);
  }

  beforeEach(() => {
    mockFs.downloadAsync.mockResolvedValue({ status: 200, uri: 'file:///cache/clip.mp4' } as never);
    mockMedia.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockSharing.isAvailableAsync.mockResolvedValue(true);
  });

  it('downloads the file into the cache directory', async () => {
    await save('clip.mp4');

    expect(mockFs.downloadAsync).toHaveBeenCalledWith(
      'http://server:8787/files/dl-1/clip.mp4',
      'file:///cache/clip.mp4',
    );
  });

  it('escapes the file name in the local path', async () => {
    await save('my clip.mp4');

    expect(mockFs.downloadAsync.mock.calls[0][1]).toBe('file:///cache/my%20clip.mp4');
  });

  it('reports a failed download', async () => {
    mockFs.downloadAsync.mockResolvedValue({ status: 404, uri: '' } as never);

    await expect(save('clip.mp4')).rejects.toThrow('Failed to fetch file (404)');
  });

  it.each(['clip.mp4', 'clip.MKV', 'clip.mov', 'clip.webm', 'clip.m4v'])(
    'saves %s to the media library',
    async (name) => {
      await save(name);

      expect(mockMedia.saveToLibraryAsync).toHaveBeenCalled();
      expect(mockSharing.shareAsync).not.toHaveBeenCalled();
    },
  );

  it('shares an audio file instead of saving it to the library', async () => {
    await save('song.mp3');

    expect(mockMedia.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(mockSharing.shareAsync).toHaveBeenCalledWith('file:///cache/clip.mp4');
  });

  it('falls back to sharing when the media permission is refused', async () => {
    mockMedia.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);

    await save('clip.mp4');

    expect(mockMedia.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(mockSharing.shareAsync).toHaveBeenCalled();
  });

  it('returns the local URI even when sharing is unavailable', async () => {
    mockSharing.isAvailableAsync.mockResolvedValue(false);

    await expect(save('song.mp3')).resolves.toBe('file:///cache/clip.mp4');
    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('saveAllToDevice', () => {
  beforeEach(() => {
    mockFs.downloadAsync.mockResolvedValue({ status: 200, uri: 'file:///cache/a.mp4' } as never);
    mockMedia.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockSharing.isAvailableAsync.mockResolvedValue(true);
  });

  it('saves every file in turn', async () => {
    await setServerUrl('http://server:8787');

    await saveAllToDevice('dl-1', ['a.mp4', 'b.mp4']);

    expect(mockFs.downloadAsync).toHaveBeenCalledTimes(2);
  });

  it('stops at the first failure', async () => {
    await setServerUrl('http://server:8787');
    mockFs.downloadAsync.mockResolvedValueOnce({ status: 500, uri: '' } as never);

    await expect(saveAllToDevice('dl-1', ['a.mp4', 'b.mp4'])).rejects.toThrow(/500/);
    expect(mockFs.downloadAsync).toHaveBeenCalledTimes(1);
  });
});
