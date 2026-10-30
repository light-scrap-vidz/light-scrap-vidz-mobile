import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SERVER_URL_KEY = 'light-scrap-vidz:serverUrl';
const LEGACY_SERVER_URL_KEY = 'light-scrap-vidZ:serverUrl';

const TOKEN_KEY = 'light-scrap-vidz:token';

let cached: string | null = null;
let cachedToken: string | null = null;

/** Read the stored server URL, adopting the pre-rename key on first run. */
export async function readStoredUrl(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  if (stored !== null) return stored;

  const legacy = await AsyncStorage.getItem(LEGACY_SERVER_URL_KEY);
  if (legacy !== null) {
    await AsyncStorage.setItem(SERVER_URL_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_SERVER_URL_KEY);
  }
  return legacy;
}

function fromConfig(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { defaultServerUrl?: string };
  return (extra.defaultServerUrl ?? '').trim();
}

/** Normalise a base URL: trim, strip trailing slash, default scheme to http. */
export function normalizeServerUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url;
}

export async function getServerUrl(): Promise<string> {
  if (cached !== null) return cached;
  const stored = await readStoredUrl();
  cached = stored ?? fromConfig();
  return cached;
}

export async function setServerUrl(raw: string): Promise<string> {
  const url = normalizeServerUrl(raw);
  cached = url;
  await AsyncStorage.setItem(SERVER_URL_KEY, url);
  return url;
}

/** The shared secret the server asks for (its `AUTH_TOKEN`). */
export async function getToken(): Promise<string> {
  if (cachedToken !== null) return cachedToken;
  cachedToken = (await AsyncStorage.getItem(TOKEN_KEY)) ?? '';
  return cachedToken;
}

export async function setToken(raw: string): Promise<string> {
  const token = raw.trim();
  cachedToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}
