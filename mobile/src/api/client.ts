import type { PoseLibrary } from '../pose/types';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  fallbackMessage,
} from './errors';
import type {
  AnalyzeInput,
  AnalyzeResult,
  AuthResponse,
  FeedPage,
  FriendRequest,
  FriendRequests,
  Health,
  Photo,
  SendPhotoInput,
  UploadFile,
  User,
} from './types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Current server URL (read on every request, so settings changes apply at once). */
  getBaseUrl: () => string;
  /** Current bearer token, or null when logged out. */
  getToken: () => string | null;
  /** Called when an authenticated request answers 401. */
  onUnauthorized?: () => void;
  fetchImpl?: FetchLike;
  /** Default request timeout in ms. */
  timeoutMs?: number;
}

type Query = Record<string, string | number | null | undefined>;

interface RequestOptions {
  json?: unknown;
  form?: FormData;
  query?: Query;
  /** Send the bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
}

/** Normalises a user-typed server URL: adds http:// and strips trailing slashes. */
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim();
  if (url.length === 0) {
    return url;
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

function buildQuery(query: Query | undefined): string {
  if (!query) {
    return '';
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function filePart(file: UploadFile, defaultName: string) {
  return {
    uri: file.uri,
    name: file.name ?? defaultName,
    type: file.type ?? 'image/jpeg',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readErrorBody(
  response: Response,
): Promise<{ code: string | null; message: string | null }> {
  try {
    const text = await response.text();
    if (!text) {
      return { code: null, message: null };
    }
    const body: unknown = JSON.parse(text);
    if (!isRecord(body)) {
      return { code: null, message: null };
    }
    const code = typeof body.detail === 'string' ? body.detail : null;
    const message =
      typeof body.message === 'string' && body.message.length > 0
        ? body.message
        : null;
    return { code, message };
  } catch {
    return { code: null, message: null };
  }
}

const RETRY_DELAY_MS = 500;

function photoForm(input: SendPhotoInput): FormData {
  const form = new FormData();
  form.append('file', filePart(input.file, 'photo.jpg'));
  if (input.caption && input.caption.trim().length > 0) {
    form.append('caption', input.caption.trim());
  }
  if (input.recipientIds && input.recipientIds.length > 0) {
    form.append('recipient_ids', input.recipientIds.join(','));
  }
  form.append('mirror', input.mirror ? 'true' : 'false');
  if (input.poseId) {
    form.append('pose_id', input.poseId);
  }
  if (input.clientId) {
    form.append('client_id', input.clientId);
  }
  return form;
}

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl: FetchLike =
    options.fetchImpl ?? ((input, init) => fetch(input, init));
  const defaultTimeout = options.timeoutMs ?? 15000;

  function baseUrl(): string {
    return normalizeBaseUrl(options.getBaseUrl());
  }

  function authHeaders(): Record<string, string> {
    const token = options.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Absolute URL for a server path such as `/media/photos/12`. */
  function url(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    return `${baseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  async function request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const useAuth = opts.auth !== false;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(useAuth ? authHeaders() : {}),
    };
    let body: string | FormData | undefined;
    if (opts.form) {
      body = opts.form;
      // Let fetch set the multipart boundary.
    } else if (opts.json !== undefined) {
      body = JSON.stringify(opts.json);
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs ?? defaultTimeout);

    let response: Response;
    try {
      response = await fetchImpl(`${url(path)}${buildQuery(opts.query)}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(
        timedOut ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE,
        0,
        timedOut ? 'timeout' : 'network',
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const { code, message } = await readErrorBody(response);
      if (response.status === 401 && useAuth) {
        options.onUnauthorized?.();
      }
      throw new ApiError(
        message ?? fallbackMessage(response.status),
        response.status,
        code,
      );
    }
    if (response.status === 204) {
      return null as T;
    }
    const text = await response.text();
    if (!text) {
      return null as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(
        'Máy chủ trả về dữ liệu không hợp lệ.',
        response.status,
        'bad_response',
      );
    }
  }

  return {
    url,
    authHeaders,
    baseUrl,

    health: () =>
      request<Health>('GET', '/health', { auth: false, timeoutMs: 5000 }),

    // Auth
    register: (input: {
      username: string;
      display_name: string;
      password: string;
    }) =>
      request<AuthResponse>('POST', '/auth/register', {
        json: input,
        auth: false,
      }),
    login: (input: { username: string; password: string }) =>
      request<AuthResponse>('POST', '/auth/login', {
        json: input,
        auth: false,
      }),
    me: () => request<User>('GET', '/me'),
    updateMe: (input: { display_name: string }) =>
      request<User>('PATCH', '/me', { json: input }),
    uploadAvatar: (file: UploadFile) => {
      const form = new FormData();
      form.append('file', filePart(file, 'avatar.jpg'));
      return request<User>('POST', '/me/avatar', { form, timeoutMs: 30000 });
    },

    // Users & friends
    searchUsers: (q: string) =>
      request<User[]>('GET', '/users/search', { query: { q } }),
    friends: () => request<User[]>('GET', '/friends'),
    friendRequests: () => request<FriendRequests>('GET', '/friends/requests'),
    sendFriendRequest: (username: string) =>
      request<FriendRequest>('POST', '/friends/requests', {
        json: { username },
      }),
    acceptFriendRequest: (id: number) =>
      request<FriendRequest>('POST', `/friends/requests/${id}/accept`),
    declineFriendRequest: (id: number) =>
      request<FriendRequest>('POST', `/friends/requests/${id}/decline`),
    removeFriend: (userId: number) =>
      request<null>('DELETE', `/friends/${userId}`),

    // Photos
    sendPhoto: async (input: SendPhotoInput) => {
      const send = () =>
        request<Photo>('POST', '/photos', {
          form: photoForm(input),
          timeoutMs: 45000,
        });
      try {
        return await send();
      } catch (e) {
        // A pooled connection the server has just closed fails a POST at once with a network
        // error and nothing stored. client_id makes the upload idempotent, so one retry is safe.
        if (input.clientId && e instanceof ApiError && e.code === 'network') {
          await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          return send();
        }
        throw e;
      }
    },
    feed: (params: { beforeId?: number | null; limit?: number } = {}) =>
      request<FeedPage>('GET', '/photos/feed', {
        query: { before_id: params.beforeId, limit: params.limit ?? 30 },
      }),
    /** Newest photo a friend sent to me, or null (204). */
    latestPhoto: () => request<Photo | null>('GET', '/photos/latest'),
    getPhoto: (id: number) => request<Photo>('GET', `/photos/${id}`),
    deletePhoto: (id: number) => request<null>('DELETE', `/photos/${id}`),
    react: (id: number, emoji: string) =>
      request<Photo>('POST', `/photos/${id}/reactions`, { json: { emoji } }),
    unreact: (id: number) =>
      request<Photo>('DELETE', `/photos/${id}/reactions`),

    // Pose library & live analysis
    poses: () => request<PoseLibrary>('GET', '/poses', { auth: false }),
    analyze: (input: AnalyzeInput) => {
      const form = new FormData();
      form.append('file', filePart(input.file, 'frame.jpg'));
      form.append('mirror', input.mirror ? 'true' : 'false');
      if (input.poseId) {
        form.append('pose_id', input.poseId);
      }
      return request<AnalyzeResult>('POST', '/analyze', {
        form,
        timeoutMs: 8000,
      });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
