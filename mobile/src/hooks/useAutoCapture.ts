import { useEffect, useReducer, useRef } from 'react';
import type { AnalyzeResult } from '../api/types';
import { autoCaptureReducer, initialAutoCaptureState } from './autoCapture';

export interface UseAutoCaptureOptions {
  enabled: boolean;
  /** Latest /analyze result; each new object counts as one analysis. */
  result: AnalyzeResult | null;
  onCapture: () => void;
}

/** Returns the countdown number to display (3, 2, 1) or null. */
export function useAutoCapture({
  enabled,
  result,
  onCapture,
}: UseAutoCaptureOptions): number | null {
  const [state, dispatch] = useReducer(
    autoCaptureReducer,
    initialAutoCaptureState,
  );
  const onCaptureRef = useRef(onCapture);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    if (!enabled) {
      dispatch({ type: 'reset' });
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled && result) {
      dispatch({ type: 'analysis', ready: result.match?.ready === true });
    }
  }, [enabled, result]);

  const counting = state.phase === 'countdown';
  useEffect(() => {
    if (!counting) {
      return;
    }
    const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(id);
  }, [counting]);

  useEffect(() => {
    if (state.phase === 'capture') {
      dispatch({ type: 'reset' });
      onCaptureRef.current();
    }
  }, [state.phase]);

  return state.phase === 'countdown' ? state.count : null;
}
