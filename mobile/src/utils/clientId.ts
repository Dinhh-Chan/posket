/**
 * A key for one capture, sent as `client_id` with the upload so a retried upload is stored once.
 * Matches the backend rule: 8–64 characters of [A-Za-z0-9_-].
 */
export function newClientId(now: number = Date.now(), random: () => number = Math.random): string {
  const time = now.toString(36);
  let tail = '';
  while (tail.length < 10) {
    tail += Math.floor(random() * 36).toString(36);
  }
  return `cap-${time}-${tail}`;
}
