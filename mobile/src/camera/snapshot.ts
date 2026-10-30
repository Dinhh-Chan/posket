import type { Image } from 'react-native-nitro-image';
import { fitWithin } from '../pose/geometry';

/**
 * Helpers around VisionCamera v5 snapshots.
 *
 * On Android `CameraRef.takeSnapshot()` returns the PreviewView's bitmap
 * (CameraX `PreviewView.getBitmap()`): exactly what is displayed, already
 * centre-cropped to the (square) view and, for the front camera, already
 * mirrored like the preview. Verified on the Android emulator (API 36, front
 * camera): a screenshot of the live preview and the captured snapshot match
 * closely in the same orientation (mean abs. pixel difference 1.1 vs 45.6
 * when one of them is flipped), so the app sends `mirror=false`.
 * iOS has no preview snapshot; there the photo output is used and `mirror`
 * is derived from `Photo.isMirrored` (not tested: no macOS here).
 */
export const SNAPSHOT_IS_MIRRORED_LIKE_PREVIEW = true;

export interface SavedImage {
  /** file:// URI */
  uri: string;
  width: number;
  height: number;
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function release(image: Image, keep: Image): void {
  if (image !== keep) {
    try {
      image.dispose();
    } catch {
      // already released
    }
  }
}

/** Downscales (longest side ≤ maxSide) and writes a unique temporary JPEG. */
export async function saveScaledJpeg(
  image: Image,
  maxSide: number,
  quality: number,
): Promise<SavedImage> {
  const size = fitWithin(image.width, image.height, maxSide);
  const scaled =
    size.width < image.width
      ? await image.resizeAsync(size.width, size.height)
      : image;
  try {
    const path = await scaled.saveToTemporaryFileAsync('jpg', quality);
    return { uri: toFileUri(path), width: scaled.width, height: scaled.height };
  } finally {
    release(scaled, image);
  }
}

let analysisDir: string | null = null;
let analysisSlot = 0;

/**
 * Writes an analysis frame. After the first call the frames alternate between
 * two fixed files in the cache directory, so ~1.5 frames/s do not pile up
 * temporary files (requests never overlap, so a file is never rewritten while
 * it is being uploaded).
 */
export async function saveAnalysisFrame(
  image: Image,
  maxSide: number,
  quality: number,
): Promise<string> {
  const size = fitWithin(image.width, image.height, maxSide);
  const scaled =
    size.width < image.width
      ? await image.resizeAsync(size.width, size.height)
      : image;
  try {
    if (!analysisDir) {
      const first = await scaled.saveToTemporaryFileAsync('jpg', quality);
      const plain = first.replace(/^file:\/\//, '');
      analysisDir = plain.substring(0, plain.lastIndexOf('/'));
      return toFileUri(plain);
    }
    analysisSlot = 1 - analysisSlot;
    const path = `${analysisDir}/posecam-analyze-${analysisSlot}.jpg`;
    await scaled.saveToFileAsync(path, 'jpg', quality);
    return toFileUri(path);
  } finally {
    release(scaled, image);
  }
}
