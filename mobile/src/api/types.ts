/** Objects of the PoseCam backend contract (docs/API.md, v1). */

export interface User {
  id: number;
  username: string;
  display_name: string;
  /** Relative to the server URL, e.g. "/media/avatars/1?v=3", or null. */
  avatar_url: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Reaction {
  user: User;
  emoji: string;
  created_at: string;
}

export interface Photo {
  id: number;
  sender: User;
  image_url: string;
  width: number;
  height: number;
  caption: string | null;
  pose_id: string | null;
  created_at: string;
  is_mine: boolean;
  reactions: Reaction[];
}

export interface FeedPage {
  items: Photo[];
  next_before_id: number | null;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: number;
  from_user: User;
  to_user: User;
  status: FriendRequestStatus;
  created_at: string;
}

export interface FriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface Health {
  status: 'ok';
  detector: 'mediapipe' | 'unavailable';
}

/** [x, y, visibility] in displayed-square space (0..1, y down). */
export type DetectedKeypoint = [number, number, number];
/** [x, y, w, h] in displayed-square space. */
export type BBox = [number, number, number, number];

export interface DetectedPerson {
  keypoints: DetectedKeypoint[];
  bbox: BBox;
  score: number;
}

export interface DetectedObject {
  label: string;
  score: number;
  bbox: BBox;
}

export type SceneKind =
  | 'selfie'
  | 'solo'
  | 'duo'
  | 'group'
  | 'objects'
  | 'pet'
  | 'scenery';

export interface Scene {
  kind: SceneKind;
  person_count: number;
  object_count: number;
}

export interface Suggestion {
  pose_id: string;
  score: number;
  reason: string;
}

export type MatchStatus =
  | 'ok'
  | 'no_person'
  | 'wrong_count'
  | 'partial'
  | 'not_applicable';

export interface LimbMatch {
  person: number;
  limb: string;
  ok: boolean;
  score: number;
}

/** Composition poses with targets: one entry per target guide, in guide order. */
export interface TargetMatch {
  /** Ordinal among the pose's target guides (0-based). */
  index: number;
  label: string;
  ok: boolean;
  score: number;
}

export interface PoseMatch {
  pose_id: string;
  status: MatchStatus;
  score: number | null;
  ready: boolean;
  /** Library limb ids plus "head" (neck stroke + head circle). */
  limbs: LimbMatch[];
  targets?: TargetMatch[];
  /** Vietnamese, most important first, ≤ 2; sides are screen sides. */
  hints: string[];
}

export interface AnalyzeResult {
  persons: DetectedPerson[];
  objects: DetectedObject[];
  scene: Scene;
  suggestions: Suggestion[];
  match: PoseMatch | null;
  elapsed_ms: number;
}

/** A local image file to upload (e.g. a camera snapshot saved as JPEG). */
export interface UploadFile {
  /** file:// URI */
  uri: string;
  name?: string;
  type?: string;
}

export interface SendPhotoInput {
  file: UploadFile;
  caption?: string;
  /** Empty or omitted = all friends. */
  recipientIds?: number[];
  mirror?: boolean;
  poseId?: string | null;
}

export interface AnalyzeInput {
  file: UploadFile;
  mirror?: boolean;
  poseId?: string | null;
}
