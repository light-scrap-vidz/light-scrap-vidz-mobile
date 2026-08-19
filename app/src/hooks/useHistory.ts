import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryEntry } from '@/types';

const STORAGE_KEY = 'light-scrap-vidz:history';
const LEGACY_STORAGE_KEY = 'light-scrap-vidZ:history';
const MAX_ENTRIES = 50;

/** Read the stored history, adopting the pre-rename key on first run. */
export async function loadRawHistory(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw !== null) return raw;

  const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy !== null) {
    await AsyncStorage.setItem(STORAGE_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return legacy;
}

interface UseHistoryReturn {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
}

export function useHistory(): UseHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Load persisted history once.
  useEffect(() => {
    let active = true;
    loadRawHistory()
      .then((raw) => {
        if (active && raw) setEntries(JSON.parse(raw) as HistoryEntry[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const updated = [entry, ...prev].slice(0, MAX_ENTRIES);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    void AsyncStorage.removeItem(STORAGE_KEY);
    setEntries([]);
  }, []);

  return { entries, addEntry, clearHistory };
}
