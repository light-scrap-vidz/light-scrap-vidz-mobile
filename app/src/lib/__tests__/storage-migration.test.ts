import AsyncStorage from '@react-native-async-storage/async-storage';
import { readStoredUrl } from '@/lib/config';

const SERVER_URL_KEY = 'light-scrap-vidz:serverUrl';
const LEGACY_SERVER_URL_KEY = 'light-scrap-vidZ:serverUrl';

describe('server URL migration off the pre-rename key', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('adopts the legacy URL and drops the legacy key', async () => {
    await AsyncStorage.setItem(LEGACY_SERVER_URL_KEY, 'http://old-host:8787');

    await expect(readStoredUrl()).resolves.toBe('http://old-host:8787');
    await expect(AsyncStorage.getItem(SERVER_URL_KEY)).resolves.toBe('http://old-host:8787');
    await expect(AsyncStorage.getItem(LEGACY_SERVER_URL_KEY)).resolves.toBeNull();
  });

  it('prefers the current key and leaves the legacy one untouched', async () => {
    await AsyncStorage.setItem(SERVER_URL_KEY, 'http://current:8787');
    await AsyncStorage.setItem(LEGACY_SERVER_URL_KEY, 'http://legacy:8787');

    await expect(readStoredUrl()).resolves.toBe('http://current:8787');
    await expect(AsyncStorage.getItem(LEGACY_SERVER_URL_KEY)).resolves.toBe('http://legacy:8787');
  });

  it('returns null when neither key is set', async () => {
    await expect(readStoredUrl()).resolves.toBeNull();
  });
});
