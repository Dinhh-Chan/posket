import { createApiClient, normalizeBaseUrl } from '../src/api/client';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../src/api/errors';

type Call = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

function setup(
  responses: Array<Response | Error>,
  token: string | null = 'tok123',
) {
  const calls: Call[] = [];
  const onUnauthorized = jest.fn();
  const fetchImpl = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    const next = responses.shift();
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(next ?? jsonResponse(200, {}));
  });
  const api = createApiClient({
    getBaseUrl: () => 'http://10.0.2.2:8020/',
    getToken: () => token,
    onUnauthorized,
    fetchImpl,
  });
  return { api, calls, onUnauthorized };
}

function headersOf(call: Call): Record<string, string> {
  return call.init.headers as Record<string, string>;
}

type FieldValue = string | { uri: string; name?: string; type?: string };

/** Records multipart fields like React Native's FormData ({ uri, name, type } file parts). */
class FakeFormData {
  fields: Array<[string, FieldValue]> = [];
  append(name: string, value: FieldValue) {
    this.fields.push([name, value]);
  }
}

function fieldsOf(call: Call): Array<[string, FieldValue]> {
  return (call.init.body as unknown as FakeFormData).fields;
}

function field(call: Call, name: string): FieldValue | undefined {
  return fieldsOf(call).find(([n]) => n === name)?.[1];
}

const scope = globalThis as unknown as { FormData: unknown };
const realFormData = scope.FormData;
beforeAll(() => {
  scope.FormData = FakeFormData;
});
afterAll(() => {
  scope.FormData = realFormData;
});

describe('normalizeBaseUrl', () => {
  it('adds a scheme and strips trailing slashes', () => {
    expect(normalizeBaseUrl(' 192.168.1.5:8020/ ')).toBe(
      'http://192.168.1.5:8020',
    );
    expect(normalizeBaseUrl('https://posecam.example.com//')).toBe(
      'https://posecam.example.com',
    );
  });
});

describe('API client', () => {
  it('sends the bearer token and parses JSON', async () => {
    const user = {
      id: 1,
      username: 'linh',
      display_name: 'Linh',
      avatar_url: null,
    };
    const { api, calls } = setup([jsonResponse(200, user)]);
    await expect(api.me()).resolves.toEqual(user);
    expect(calls[0].url).toBe('http://10.0.2.2:8020/me');
    expect(calls[0].init.method).toBe('GET');
    expect(headersOf(calls[0]).Authorization).toBe('Bearer tok123');
  });

  it('does not send the token to login and posts JSON', async () => {
    const { api, calls } = setup([
      jsonResponse(200, {
        token: 't',
        user: { id: 2, username: 'a', display_name: 'A', avatar_url: null },
      }),
    ]);
    await api.login({ username: 'abc', password: 'secret1' });
    expect(headersOf(calls[0]).Authorization).toBeUndefined();
    expect(headersOf(calls[0])['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      username: 'abc',
      password: 'secret1',
    });
  });

  it('builds query strings and skips empty values', async () => {
    const { api, calls } = setup([
      jsonResponse(200, { items: [], next_before_id: null }),
    ]);
    await api.feed({ beforeId: 42 });
    expect(calls[0].url).toBe(
      'http://10.0.2.2:8020/photos/feed?before_id=42&limit=30',
    );
    const second = setup([
      jsonResponse(200, { items: [], next_before_id: null }),
    ]);
    await second.api.feed();
    expect(second.calls[0].url).toBe(
      'http://10.0.2.2:8020/photos/feed?limit=30',
    );
  });

  it('sends photo multipart fields', async () => {
    const { api, calls } = setup([jsonResponse(201, { id: 9 })]);
    await api.sendPhoto({
      file: { uri: 'file:///cache/a.jpg' },
      caption: '  Chiều nay ☀️ ',
      recipientIds: [3, 5],
      mirror: true,
      poseId: 'solo-hand-on-hip',
    });
    expect(calls[0].url).toBe('http://10.0.2.2:8020/photos');
    expect(calls[0].init.method).toBe('POST');
    expect(headersOf(calls[0]).Authorization).toBe('Bearer tok123');
    // The multipart boundary is set by fetch, never by hand.
    expect(headersOf(calls[0])['Content-Type']).toBeUndefined();
    expect(calls[0].init.body).toBeInstanceOf(FakeFormData);
    expect(field(calls[0], 'file')).toEqual({
      uri: 'file:///cache/a.jpg',
      type: 'image/jpeg',
      name: 'photo.jpg',
    });
    expect(field(calls[0], 'caption')).toBe('Chiều nay ☀️');
    expect(field(calls[0], 'recipient_ids')).toBe('3,5');
    expect(field(calls[0], 'mirror')).toBe('true');
    expect(field(calls[0], 'pose_id')).toBe('solo-hand-on-hip');
  });

  it('omits optional photo fields (all friends, no pose)', async () => {
    const { api, calls } = setup([jsonResponse(201, { id: 9 })]);
    await api.sendPhoto({
      file: { uri: 'file:///cache/b.jpg' },
      recipientIds: [],
    });
    const names = fieldsOf(calls[0]).map(([name]) => name);
    expect(names).toEqual(['file', 'mirror']);
    expect(field(calls[0], 'mirror')).toBe('false');
  });

  it('sends analyze multipart with mirror and pose_id', async () => {
    const { api, calls } = setup([
      jsonResponse(200, {
        persons: [],
        objects: [],
        scene: { kind: 'solo', person_count: 0, object_count: 0 },
        suggestions: [],
        match: null,
        elapsed_ms: 3,
      }),
    ]);
    const res = await api.analyze({
      file: { uri: 'file:///f.jpg' },
      mirror: false,
      poseId: 'duo-heart',
    });
    expect(res.scene.kind).toBe('solo');
    expect(fieldsOf(calls[0]).map(([name]) => name)).toEqual([
      'file',
      'mirror',
      'pose_id',
    ]);
    expect(field(calls[0], 'file')).toMatchObject({
      uri: 'file:///f.jpg',
      name: 'frame.jpg',
    });
    expect(field(calls[0], 'mirror')).toBe('false');
    expect(field(calls[0], 'pose_id')).toBe('duo-heart');
  });

  it('maps backend errors to ApiError with the Vietnamese message', async () => {
    const { api } = setup([
      jsonResponse(409, {
        detail: 'username_taken',
        message: 'Tên người dùng đã có người dùng',
      }),
    ]);
    const err = await api
      .register({ username: 'linh', display_name: 'Linh', password: '123456' })
      .catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('username_taken');
    expect(err.message).toBe('Tên người dùng đã có người dùng');
  });

  it('falls back to a Vietnamese message when the body has none', async () => {
    const { api } = setup([jsonResponse(500, undefined)]);
    const err = await api.friends().catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/Máy chủ/);
  });

  it('maps network failures to status 0 with a Vietnamese message', async () => {
    const { api } = setup([new TypeError('Network request failed')]);
    const err = await api.friends().catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.isNetwork).toBe(true);
    expect(err.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('calls onUnauthorized on 401 for authenticated calls only', async () => {
    const a = setup([
      jsonResponse(401, {
        detail: 'invalid_token',
        message: 'Phiên đăng nhập hết hạn',
      }),
    ]);
    await expect(a.api.me()).rejects.toBeInstanceOf(ApiError);
    expect(a.onUnauthorized).toHaveBeenCalledTimes(1);

    const b = setup([
      jsonResponse(401, {
        detail: 'invalid_credentials',
        message: 'Sai tên đăng nhập hoặc mật khẩu',
      }),
    ]);
    const err = await b.api
      .login({ username: 'x', password: 'y' })
      .catch(e => e);
    expect(err.message).toBe('Sai tên đăng nhập hoặc mật khẩu');
    expect(b.onUnauthorized).not.toHaveBeenCalled();
  });

  it('returns null for 204 (no latest photo)', async () => {
    const { api } = setup([jsonResponse(204, undefined)]);
    await expect(api.latestPhoto()).resolves.toBeNull();
  });

  it('builds absolute media URLs', () => {
    const { api } = setup([]);
    expect(api.url('/media/photos/12')).toBe(
      'http://10.0.2.2:8020/media/photos/12',
    );
    expect(api.authHeaders()).toEqual({ Authorization: 'Bearer tok123' });
  });
});

describe('photo upload retry', () => {
  it('retries once after a network error with the same client_id', async () => {
    const { api, calls } = setup([
      new TypeError('Network request failed'),
      jsonResponse(201, { id: 12 }),
    ]);
    const photo = await api.sendPhoto({
      file: { uri: 'file:///cache/c.jpg' },
      clientId: 'cap-test-0001',
    });
    expect(photo).toEqual({ id: 12 });
    expect(calls).toHaveLength(2);
    expect(field(calls[0], 'client_id')).toBe('cap-test-0001');
    expect(field(calls[1], 'client_id')).toBe('cap-test-0001');
  });

  it('does not retry without a client_id or after an HTTP error', async () => {
    const offline = setup([new TypeError('Network request failed')]);
    await expect(
      offline.api.sendPhoto({ file: { uri: 'file:///cache/d.jpg' } }),
    ).rejects.toMatchObject({ code: 'network' });
    expect(offline.calls).toHaveLength(1);

    const refused = setup([
      jsonResponse(403, { detail: 'forbidden', message: 'Chỉ gửi được ảnh cho bạn bè' }),
    ]);
    await expect(
      refused.api.sendPhoto({ file: { uri: 'file:///cache/e.jpg' }, clientId: 'cap-test-0002' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(refused.calls).toHaveLength(1);
  });
});
