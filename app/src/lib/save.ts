import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { fileUrl } from './api';

const VIDEO_EXTS = ['.mp4', '.mkv', '.mov', '.webm', '.m4v'];

function isVideo(name: string): boolean {
  const lower = name.toLowerCase();
  return VIDEO_EXTS.some((ext) => lower.endsWith(ext));
}

/**
 * Downloads one server-side file to the device, then either saves it to the
 * media library (videos) or opens the share sheet (audio / other).
 * Returns the local URI of the downloaded file.
 */
export async function saveFileToDevice(downloadId: string, filename: string): Promise<string> {
  const remote = await fileUrl(downloadId, filename);
  const localUri = `${FileSystem.cacheDirectory}${encodeURIComponent(filename)}`;

  const result = await FileSystem.downloadAsync(remote, localUri);
  if (result.status !== 200) {
    throw new Error(`Failed to fetch file (${result.status})`);
  }

  if (isVideo(filename)) {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (perm.granted) {
      await MediaLibrary.saveToLibraryAsync(result.uri);
      return result.uri;
    }
  }

  // Audio or no media permission → let the user save/share it anywhere.
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri);
  }
  return result.uri;
}

/** Saves every produced file, surfacing the first error if any occurs. */
export async function saveAllToDevice(downloadId: string, filenames: string[]): Promise<void> {
  for (const name of filenames) {
    await saveFileToDevice(downloadId, name);
  }
}
