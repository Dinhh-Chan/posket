import { newClientId } from '../src/utils/clientId';

describe('newClientId', () => {
  it('matches the backend rule and differs between captures', () => {
    const a = newClientId();
    const b = newClientId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(a).not.toBe(b);
  });

  it('is deterministic for a given clock and random source', () => {
    expect(newClientId(0, () => 0)).toBe('cap-0-0000000000');
  });
});
