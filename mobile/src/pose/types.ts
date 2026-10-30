/** Pose library format (docs/API.md "Pose library"). */

/** [x, y] normalised to the square frame (0..1, y down), or null if not part of the pose. */
export type PoseKeypoint = [number, number] | null;

export interface PoseHead {
  cx: number;
  cy: number;
  r: number;
}

export interface PosePerson {
  keypoints: PoseKeypoint[];
  head: PoseHead | null;
}

export interface LineGuide {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectGuide {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EllipseGuide {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface TargetGuide {
  type: 'target';
  cx: number;
  cy: number;
  r: number;
  label?: string;
}

export type PoseGuide = LineGuide | RectGuide | EllipseGuide | TargetGuide;

export type PoseKind = 'body' | 'composition';

export interface Pose {
  id: string;
  name: string;
  category: string;
  kind: PoseKind;
  people: number;
  objects: number;
  difficulty: number;
  tags: string[];
  tip: string;
  persons: PosePerson[];
  guides: PoseGuide[];
}

export interface PoseLimb {
  id: string;
  from: number;
  to: number;
  label: string;
}

export interface PoseCategory {
  id: string;
  label: string;
  emoji: string;
}

export interface PoseLibrary {
  version: number;
  keypoints: string[];
  limbs: PoseLimb[];
  categories: PoseCategory[];
  poses: Pose[];
}
