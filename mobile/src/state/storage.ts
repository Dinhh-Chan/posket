import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../api/types';

const KEYS = {
  token: 'posecam.token',
  user: 'posecam.user',
  serverUrl: 'posecam.serverUrl',
  autoCapture: 'posecam.autoCapture',
} as const;

export interface StoredSession {
  token: string;
  user: User;
}

async function safeGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Persisting is best effort; the in-memory state stays correct.
  }
}

async function safeRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  const [token, userJson] = await Promise.all([
    safeGet(KEYS.token),
    safeGet(KEYS.user),
  ]);
  if (!token || !userJson) {
    return null;
  }
  try {
    const user = JSON.parse(userJson) as User;
    if (typeof user?.id !== 'number') {
      return null;
    }
    return { token, user };
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    safeSet(KEYS.token, session.token),
    safeSet(KEYS.user, JSON.stringify(session.user)),
  ]);
}

export async function saveUser(user: User): Promise<void> {
  await safeSet(KEYS.user, JSON.stringify(user));
}

export async function clearSession(): Promise<void> {
  await Promise.all([safeRemove(KEYS.token), safeRemove(KEYS.user)]);
}

export async function loadServerUrl(): Promise<string | null> {
  return safeGet(KEYS.serverUrl);
}

export async function saveServerUrl(url: string): Promise<void> {
  await safeSet(KEYS.serverUrl, url);
}

export async function loadAutoCapture(): Promise<boolean> {
  return (await safeGet(KEYS.autoCapture)) === '1';
}

export async function saveAutoCapture(enabled: boolean): Promise<void> {
  await safeSet(KEYS.autoCapture, enabled ? '1' : '0');
}
