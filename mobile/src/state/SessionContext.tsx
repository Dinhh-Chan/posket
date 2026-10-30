import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createApiClient,
  normalizeBaseUrl,
  type ApiClient,
} from '../api/client';
import type { User } from '../api/types';
import { DEFAULT_SERVER_URL } from '../config';
import { widget } from '../native';
import {
  clearSession,
  loadServerUrl,
  loadSession,
  saveServerUrl,
  saveSession,
  saveUser,
} from './storage';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionValue {
  status: SessionStatus;
  user: User | null;
  token: string | null;
  serverUrl: string;
  api: ApiClient;
  login(username: string, password: string): Promise<void>;
  register(
    username: string,
    displayName: string,
    password: string,
  ): Promise<void>;
  logout(): Promise<void>;
  setUser(user: User): void;
  setServerUrl(url: string): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrlState] = useState(DEFAULT_SERVER_URL);

  // The API client reads these refs on every request.
  const tokenRef = useRef<string | null>(null);
  const serverUrlRef = useRef(DEFAULT_SERVER_URL);
  const logoutRef = useRef<() => void>(() => {});

  const api = useMemo(
    () =>
      createApiClient({
        getBaseUrl: () => serverUrlRef.current,
        getToken: () => tokenRef.current,
        onUnauthorized: () => logoutRef.current(),
      }),
    [],
  );

  const applySession = useCallback(
    (nextToken: string | null, nextUser: User | null) => {
      tokenRef.current = nextToken;
      setToken(nextToken);
      setUserState(nextUser);
      setStatus(nextToken && nextUser ? 'signedIn' : 'signedOut');
    },
    [],
  );

  const logout = useCallback(async () => {
    if (tokenRef.current === null) {
      return;
    }
    applySession(null, null);
    widget.clear();
    await clearSession();
  }, [applySession]);

  useEffect(() => {
    logoutRef.current = () => {
      logout().catch(() => {});
    };
  }, [logout]);

  // Restore server URL + session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedUrl = await loadServerUrl();
      const url = storedUrl ? normalizeBaseUrl(storedUrl) : DEFAULT_SERVER_URL;
      serverUrlRef.current = url;
      const stored = await loadSession();
      if (cancelled) {
        return;
      }
      setServerUrlState(url);
      if (stored) {
        applySession(stored.token, stored.user);
        widget.configure(url, stored.token);
        // Refresh the profile in the background; a 401 logs out via onUnauthorized.
        api
          .me()
          .then(fresh => {
            if (!cancelled && tokenRef.current === stored.token) {
              setUserState(fresh);
              saveUser(fresh).catch(() => {});
            }
          })
          .catch(() => {});
      } else {
        applySession(null, null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, applySession]);

  const startSession = useCallback(
    async (nextToken: string, nextUser: User) => {
      applySession(nextToken, nextUser);
      widget.configure(serverUrlRef.current, nextToken);
      await saveSession({ token: nextToken, user: nextUser });
    },
    [applySession],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login({
        username: username.trim().toLowerCase(),
        password,
      });
      await startSession(res.token, res.user);
    },
    [api, startSession],
  );

  const register = useCallback(
    async (username: string, displayName: string, password: string) => {
      const res = await api.register({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        password,
      });
      await startSession(res.token, res.user);
    },
    [api, startSession],
  );

  const setUser = useCallback((next: User) => {
    setUserState(next);
    saveUser(next).catch(() => {});
  }, []);

  const setServerUrl = useCallback(async (raw: string) => {
    const url = normalizeBaseUrl(raw) || DEFAULT_SERVER_URL;
    serverUrlRef.current = url;
    setServerUrlState(url);
    await saveServerUrl(url);
    if (tokenRef.current) {
      widget.configure(url, tokenRef.current);
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      token,
      serverUrl,
      api,
      login,
      register,
      logout,
      setUser,
      setServerUrl,
    }),
    [
      status,
      user,
      token,
      serverUrl,
      api,
      login,
      register,
      logout,
      setUser,
      setServerUrl,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}

/** Authorization header + absolute URL for server images (`<Image source={...} />`). */
export function useAuthImageSource() {
  const { api, token, serverUrl } = useSession();
  return useCallback(
    (path: string | null | undefined) => {
      if (!path) {
        return undefined;
      }
      return {
        uri: api.url(path),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      };
    },
    // serverUrl is read through api.url; listed so sources update when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, token, serverUrl],
  );
}
