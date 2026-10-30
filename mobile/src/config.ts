/** Backend reachable from the Android emulator (host loopback). */
export const DEFAULT_SERVER_URL = 'http://10.0.2.2:8020';

/** Analysis loop period (ms) while the pose guide is active. */
export const ANALYZE_INTERVAL_MS = 650;

/** Longest side (px) and JPEG quality of the analysis snapshot. */
export const ANALYZE_MAX_SIDE = 640;
export const ANALYZE_JPEG_QUALITY = 50;

/** Captured photo: longest side and JPEG quality before upload. */
export const PHOTO_MAX_SIDE = 1080;
export const PHOTO_JPEG_QUALITY = 90;

export const CAPTION_MAX = 60;

/** Feed refresh period (ms) while the history page is visible. */
export const FEED_REFRESH_MS = 20000;

export const REACTION_EMOJIS = ['❤️', '😂', '😍', '🔥', '👏'] as const;
