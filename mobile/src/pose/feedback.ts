import type { PoseMatch } from '../api/types';
import type { Pose } from './types';

/** Soft Vietnamese message for statuses without a usable score, or null. */
export function statusMessage(
  match: PoseMatch | null | undefined,
  pose: Pose | undefined,
): string | null {
  if (!match) {
    return null;
  }
  switch (match.status) {
    case 'no_person':
      return pose && pose.people > 1
        ? `Chưa thấy ai — dáng này cần ${pose.people} người`
        : 'Chưa thấy ai trong khung hình';
    case 'wrong_count':
      if (pose && pose.kind === 'composition' && pose.objects > 0) {
        return `Cần ${pose.objects} đồ vật trong khung`;
      }
      return pose
        ? `Dáng này cần ${pose.people} người trong khung`
        : 'Số người chưa khớp với dáng';
    case 'partial':
      return 'Chưa thấy đủ người — lùi ra xa một chút';
    default:
      return null;
  }
}

/** Score to show in the badge (only for ok / partial with a number). */
export function displayScore(
  match: PoseMatch | null | undefined,
): number | null {
  if (!match || match.score === null || match.score === undefined) {
    return null;
  }
  if (match.status !== 'ok' && match.status !== 'partial') {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(match.score)));
}

/** At most two hints, most important first. */
export function visibleHints(match: PoseMatch | null | undefined): string[] {
  return match ? match.hints.filter(h => h.trim().length > 0).slice(0, 2) : [];
}
