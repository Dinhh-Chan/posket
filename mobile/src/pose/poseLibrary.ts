import rawLibrary from './library.json';
import type {
  Pose,
  PoseCategory,
  PoseGuide,
  PoseLibrary,
  PosePerson,
} from './types';

function normalizePose(raw: Pose): Pose {
  const persons: PosePerson[] = Array.isArray(raw.persons) ? raw.persons : [];
  const guides: PoseGuide[] = Array.isArray(raw.guides) ? raw.guides : [];
  return {
    ...raw,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    tip: raw.tip ?? '',
    difficulty: raw.difficulty ?? 1,
    persons,
    guides,
  };
}

/** Validates the shape loosely and fills optional fields with defaults. */
export function parseLibrary(raw: unknown): PoseLibrary {
  const lib = raw as PoseLibrary;
  if (!lib || !Array.isArray(lib.poses) || !Array.isArray(lib.limbs)) {
    throw new Error('Invalid pose library');
  }
  return {
    version: lib.version,
    keypoints: lib.keypoints,
    limbs: lib.limbs,
    categories: Array.isArray(lib.categories) ? lib.categories : [],
    poses: lib.poses.map(normalizePose),
  };
}

/** The pose library bundled with the app (synced from poses/library.json). */
export const library: PoseLibrary = parseLibrary(rawLibrary);

const poseById = new Map<string, Pose>(library.poses.map(p => [p.id, p]));

export function getPose(id: string | null | undefined): Pose | undefined {
  return id ? poseById.get(id) : undefined;
}

export function getCategory(id: string): PoseCategory | undefined {
  return library.categories.find(c => c.id === id);
}

export function posesInCategory(categoryId: string): Pose[] {
  return library.poses.filter(p => p.category === categoryId);
}

/** Easiest poses of a category (stable: library order within the same difficulty). */
export function easiestPoses(categoryId: string, count = 6): Pose[] {
  return posesInCategory(categoryId)
    .map((pose, index) => ({ pose, index }))
    .sort((a, b) => a.pose.difficulty - b.pose.difficulty || a.index - b.index)
    .slice(0, count)
    .map(entry => entry.pose);
}

/** Category to suggest from when the backend cannot be reached. */
export function fallbackCategory(cameraPosition: 'front' | 'back'): string {
  return cameraPosition === 'front' ? 'selfie' : 'solo';
}
