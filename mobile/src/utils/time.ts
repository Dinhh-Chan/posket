const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Short Vietnamese relative time, Locket style:
 * "vừa xong", "5 phút", "2 giờ", "hôm qua", "3 ngày", then "dd/MM" (or "dd/MM/yyyy").
 */
export function relativeTime(
  input: string | number | Date,
  now: Date = new Date(),
): string {
  const date = input instanceof Date ? input : new Date(input);
  const t = date.getTime();
  if (Number.isNaN(t)) {
    return '';
  }
  const diff = now.getTime() - t;
  if (diff < MINUTE) {
    return 'vừa xong';
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} phút`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)} giờ`;
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days <= 1) {
    return 'hôm qua';
  }
  if (days < 7) {
    return `${days} ngày`;
  }
  const dm = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  return date.getFullYear() === now.getFullYear()
    ? dm
    : `${dm}/${date.getFullYear()}`;
}
