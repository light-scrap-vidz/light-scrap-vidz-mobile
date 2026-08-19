import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useHistory } from '@/hooks/useHistory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadRawHistory } from '@/hooks/useHistory';

const STORAGE_KEY = 'light-scrap-vidz:history';
const LEGACY_STORAGE_KEY = 'light-scrap-vidZ:history';

const entries = JSON.stringify([{ id: '1', title: 'Clip' }]);

describe('history migration off the pre-rename key', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('adopts the legacy entries and drops the legacy key', async () => {
    await AsyncStorage.setItem(LEGACY_STORAGE_KEY, entries);

    await expect(loadRawHistory()).resolves.toBe(entries);
    await expect(AsyncStorage.getItem(STORAGE_KEY)).resolves.toBe(entries);
    await expect(AsyncStorage.getItem(LEGACY_STORAGE_KEY)).resolves.toBeNull();
  });

  it('prefers the current key and leaves the legacy one untouched', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, entries);
    await AsyncStorage.setItem(LEGACY_STORAGE_KEY, '[]');

    await expect(loadRawHistory()).resolves.toBe(entries);
    await expect(AsyncStorage.getItem(LEGACY_STORAGE_KEY)).resolves.toBe('[]');
  });

  it('returns null when neither key is set', async () => {
    await expect(loadRawHistory()).resolves.toBeNull();
  });
});

describe('history behaviour', () => {
  const entry: Record<string, unknown> = { id: '1', url: 'https://a', title: 'A clip' };

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts empty', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.entries).toEqual([]));
  });

  it('loads what was persisted', async () => {
    await AsyncStorage.setItem('light-scrap-vidz:history', JSON.stringify([entry]));

    const { result } = renderHook(() => useHistory());

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
  });

  it('prepends new entries and persists them', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.entries).toEqual([]));

    await act(async () => {
      result.current.addEntry(entry as never);
    });
    await act(async () => {
      result.current.addEntry({ ...entry, id: '2' } as never);
    });

    expect(result.current.entries.map((e: { id: string }) => e.id)).toEqual(['2', '1']);
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem('light-scrap-vidz:history')) ?? '[]')).toHaveLength(2),
    );
  });

  it('keeps at most 50 entries', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.entries).toEqual([]));

    await act(async () => {
      for (let i = 0; i < 55; i += 1) result.current.addEntry({ ...entry, id: String(i) } as never);
    });

    expect(result.current.entries).toHaveLength(50);
  });

  it('clearHistory empties the list and the stored key', async () => {
    const { result } = renderHook(() => useHistory());
    await act(async () => {
      result.current.addEntry(entry as never);
    });

    await act(async () => {
      result.current.clearHistory();
    });

    expect(result.current.entries).toEqual([]);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('light-scrap-vidz:history')).toBeNull(),
    );
  });

  it('recovers from corrupted stored JSON', async () => {
    await AsyncStorage.setItem('light-scrap-vidz:history', '{ not json');

    const { result } = renderHook(() => useHistory());

    await waitFor(() => expect(result.current.entries).toEqual([]));
  });
});
