import AsyncStorage from '@react-native-async-storage/async-storage';

import { PROTON_SESSION_STORAGE_KEY } from './constants';
import type { ProtonSessionTokens } from './session-types';

export async function loadPersistedTokens(): Promise<ProtonSessionTokens | null> {
  try {
    const raw = await AsyncStorage.getItem(PROTON_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ProtonSessionTokens;
    if (!parsed.uid || !parsed.accessToken || !parsed.refreshToken || !parsed.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function persistTokens(tokens: ProtonSessionTokens): Promise<void> {
  await AsyncStorage.setItem(PROTON_SESSION_STORAGE_KEY, JSON.stringify(tokens));
}

export async function clearPersistedTokens(): Promise<void> {
  await AsyncStorage.removeItem(PROTON_SESSION_STORAGE_KEY);
}
