import {useState, useEffect, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../utils/constants';
import {CollisionResult} from './useCollision';

export interface HistoryEntry {
  id: string;
  date: string;
  problem: string;
  result: CollisionResult;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const load = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.history);
    if (raw) {
      setHistory(JSON.parse(raw));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (problem: string, result: CollisionResult) => {
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        problem,
        result,
      };
      const updated = [entry, ...history];
      await AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(updated));
      setHistory(updated);
    },
    [history],
  );

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.history);
    setHistory([]);
  }, []);

  return {history, add, clear, reload: load};
}
