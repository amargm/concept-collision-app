import {useState, useEffect, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../utils/constants';

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.apiKey).then(key => {
      setApiKey(key);
      setLoading(false);
    });
  }, []);

  const saveKey = useCallback(async (key: string) => {
    const trimmed = key.trim();
    await AsyncStorage.setItem(STORAGE_KEYS.apiKey, trimmed);
    setApiKey(trimmed);
  }, []);

  const clearKey = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.apiKey);
    setApiKey(null);
  }, []);

  return {apiKey, loading, saveKey, clearKey};
}
