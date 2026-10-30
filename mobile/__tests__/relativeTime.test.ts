import { relativeTime } from '../src/utils/time';

describe('relativeTime (Vietnamese)', () => {
  const now = new Date(2026, 9, 30, 15, 0, 0); // 30/10/2026 15:00 local

  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;

  it('says "vừa xong" under a minute (and for clock skew)', () => {
    expect(relativeTime(ago(10 * 1000), now)).toBe('vừa xong');
    expect(relativeTime(new Date(now.getTime() + 5000), now)).toBe('vừa xong');
  });

  it('uses minutes and hours', () => {
    expect(relativeTime(ago(5 * MIN), now)).toBe('5 phút');
    expect(relativeTime(ago(59 * MIN), now)).toBe('59 phút');
    expect(relativeTime(ago(2 * HOUR), now)).toBe('2 giờ');
    expect(relativeTime(ago(23 * HOUR), now)).toBe('23 giờ');
  });

  it('says "hôm qua" for the previous calendar day beyond 24 h', () => {
    expect(relativeTime(new Date(2026, 9, 29, 9, 0, 0), now)).toBe('hôm qua');
  });

  it('uses days within a week, then the date', () => {
    expect(relativeTime(new Date(2026, 9, 27, 12, 0, 0), now)).toBe('3 ngày');
    expect(relativeTime(new Date(2026, 9, 1, 12, 0, 0), now)).toBe('01/10');
    expect(relativeTime(new Date(2025, 11, 24, 12, 0, 0), now)).toBe(
      '24/12/2025',
    );
  });

  it('accepts ISO strings and ignores invalid input', () => {
    expect(
      relativeTime(new Date(now.getTime() - 3 * MIN).toISOString(), now),
    ).toBe('3 phút');
    expect(relativeTime('not a date', now)).toBe('');
  });
});
