import type { PoseMatch } from '../api/types';
import { colors } from '../theme';
import type { PoseHead, PoseKeypoint, PoseLimb, PosePerson } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LimbSegment extends Segment {
  limbId: string;
}

/** Limb stroke width relative to the square side (API.md rendering rules). */
export const LIMB_WIDTH_RATIO = 0.028;

export const LIMB_OK_COLOR = colors.success;
export const LIMB_BAD_COLOR = colors.error;

/** Maps a normalised [x, y] (0..1 of the square) to pixels of a square of side `size`. */
export function toPixel(point: readonly [number, number], size: number): Point {
  return { x: point[0] * size, y: point[1] * size };
}

export function limbStrokeWidth(size: number): number {
  return Math.max(1, LIMB_WIDTH_RATIO * size);
}

export function headToPixel(
  head: PoseHead,
  size: number,
): { cx: number; cy: number; r: number } {
  return { cx: head.cx * size, cy: head.cy * size, r: head.r * size };
}

function keypointAt(
  keypoints: PoseKeypoint[],
  index: number,
): [number, number] | null {
  const kp = keypoints[index];
  return Array.isArray(kp) && kp.length >= 2 ? kp : null;
}

/** Limb strokes of one person whose two keypoints are both present, in pixels. */
export function limbSegments(
  person: PosePerson,
  limbs: PoseLimb[],
  size: number,
): LimbSegment[] {
  const result: LimbSegment[] = [];
  for (const limb of limbs) {
    const a = keypointAt(person.keypoints, limb.from);
    const b = keypointAt(person.keypoints, limb.to);
    if (!a || !b) {
      continue;
    }
    const pa = toPixel(a, size);
    const pb = toPixel(b, size);
    result.push({ limbId: limb.id, x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
  }
  return result;
}

const LEFT_SHOULDER = 5;
const RIGHT_SHOULDER = 6;

/**
 * Neck stroke: from the shoulder midpoint to the edge of the head circle facing it.
 * Null when a shoulder or the head is missing, or the midpoint lies inside the head.
 */
export function neckSegment(person: PosePerson, size: number): Segment | null {
  const ls = keypointAt(person.keypoints, LEFT_SHOULDER);
  const rs = keypointAt(person.keypoints, RIGHT_SHOULDER);
  if (!ls || !rs || !person.head) {
    return null;
  }
  const mid = toPixel([(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2], size);
  const head = headToPixel(person.head, size);
  const dx = mid.x - head.cx;
  const dy = mid.y - head.cy;
  const dist = Math.hypot(dx, dy);
  if (dist <= head.r) {
    return null;
  }
  return {
    x1: mid.x,
    y1: mid.y,
    x2: head.cx + (dx / dist) * head.r,
    y2: head.cy + (dy / dist) * head.r,
  };
}

/**
 * Colour of a limb given the latest match: green if ok, red if not,
 * null (draw white) when the limb is absent from `match.limbs`.
 */
export function limbColor(
  match: PoseMatch | null | undefined,
  personIndex: number,
  limbId: string,
): string | null {
  if (!match) {
    return null;
  }
  const entry = match.limbs.find(
    l => l.person === personIndex && l.limb === limbId,
  );
  if (!entry) {
    return null;
  }
  return entry.ok ? LIMB_OK_COLOR : LIMB_BAD_COLOR;
}

/** Limb id the backend uses for the neck stroke + head circle. */
export const HEAD_LIMB_ID = 'head';

export const TARGET_COLOR = colors.accent;

/**
 * Colour of the n-th target guide (ordinal among targets): green when the
 * latest match says it is ok, yellow otherwise.
 */
export function targetColor(
  match: PoseMatch | null | undefined,
  targetOrdinal: number,
): string {
  const entry = match?.targets?.find(t => t.index === targetOrdinal);
  return entry?.ok ? LIMB_OK_COLOR : TARGET_COLOR;
}

/** Dash pattern for guide strokes, scaled to the square side. */
export function guideDash(size: number): [number, number] {
  const dash = Math.max(3, size * 0.03);
  return [dash, dash * 0.7];
}

/** Largest square fitting a width with side margins. */
export function viewfinderSize(screenWidth: number, margin: number): number {
  return Math.max(0, Math.floor(screenWidth - margin * 2));
}

/** Target size for an image resize so that its longest side is at most `maxSide`. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest === 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
