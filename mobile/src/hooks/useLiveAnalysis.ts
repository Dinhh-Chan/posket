import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import type { AnalyzeResult } from '../api/types';
import { ANALYZE_INTERVAL_MS } from '../config';
import { useAppActive } from './useAppActive';

export interface AnalysisSnapshot {
  /** file:// URI of a small JPEG of the viewfinder. */
  uri: string;
  /** true if the preview is mirrored and this snapshot is not (API `mirror`). */
  mirror: boolean;
}

export interface UseLiveAnalysisOptions {
  /** Camera page visible, pose selected or Gợi ý tab open, not in send mode. */
  enabled: boolean;
  poseId: string | null;
  api: ApiClient;
  takeSnapshot: () => Promise<AnalysisSnapshot | null>;
  intervalMs?: number;
}

export interface LiveAnalysis {
  result: AnalyzeResult | null;
  /** false after a network error, true after a success, null before the first answer. */
  reachable: boolean | null;
  error: ApiError | null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Live pose analysis loop: about every `intervalMs` takes a small snapshot and
 * POSTs it to /analyze. Requests never overlap (the next one starts only after
 * the previous settled), and the loop stops when disabled or the app is backgrounded.
 */
export function useLiveAnalysis({
  enabled,
  poseId,
  api,
  takeSnapshot,
  intervalMs = ANALYZE_INTERVAL_MS,
}: UseLiveAnalysisOptions): LiveAnalysis {
  const appActive = useAppActive();
  const running = enabled && appActive;
  const [state, setState] = useState<LiveAnalysis>({
    result: null,
    reachable: null,
    error: null,
  });
  const snapshotRef = useRef(takeSnapshot);
  useEffect(() => {
    snapshotRef.current = takeSnapshot;
  }, [takeSnapshot]);
  /** The request currently on the wire (shared across loop restarts). */
  const inFlight = useRef<Promise<unknown> | null>(null);

  // Drop a stale match as soon as the pose changes.
  useEffect(() => {
    setState(s => (s.result ? { ...s, result: null } : s));
  }, [poseId]);

  useEffect(() => {
    if (!running) {
      return;
    }
    let cancelled = false;

    const runOnce = async (): Promise<boolean> => {
      const snapshot = await snapshotRef.current();
      if (!snapshot || cancelled) {
        return true;
      }
      const result = await api.analyze({
        file: { uri: snapshot.uri, name: 'frame.jpg', type: 'image/jpeg' },
        mirror: snapshot.mirror,
        poseId,
      });
      if (cancelled) {
        return true;
      }
      if (poseId && result.match && result.match.pose_id !== poseId) {
        return true;
      }
      setState({ result, reachable: true, error: null });
      return true;
    };

    (async () => {
      while (!cancelled) {
        const started = Date.now();
        let ok = true;
        if (inFlight.current) {
          await inFlight.current.catch(() => {});
          if (cancelled) {
            break;
          }
        }
        const request = runOnce();
        inFlight.current = request;
        try {
          ok = await request;
        } catch (e) {
          ok = false;
          if (!cancelled && e instanceof ApiError) {
            const err = e;
            setState(s => ({
              result: err.isNetwork ? null : s.result,
              // An HTTP error still means the server answered.
              reachable: !err.isNetwork,
              error: err,
            }));
          }
        } finally {
          if (inFlight.current === request) {
            inFlight.current = null;
          }
        }
        if (cancelled) {
          break;
        }
        // Back off a little after a failure so an unreachable server is not hammered.
        const period = ok ? intervalMs : intervalMs * 3;
        await delay(Math.max(0, period - (Date.now() - started)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [running, poseId, api, intervalMs]);

  return state;
}
