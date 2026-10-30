/**
 * Pure decision logic for auto-capture: `ready` must be true REQUIRED_STREAK
 * analyses in a row, then a 3-2-1 countdown runs (one `tick` per second) and the
 * photo is taken at 0. Any non-ready analysis during the countdown cancels it.
 */

export const REQUIRED_STREAK = 3;
export const COUNTDOWN_FROM = 3;

export type AutoCaptureState =
  | { phase: 'idle'; streak: number }
  | { phase: 'countdown'; count: number }
  | { phase: 'capture' };

export type AutoCaptureEvent =
  /** A new /analyze result arrived (ready = match.ready). */
  | { type: 'analysis'; ready: boolean }
  /** One second of countdown elapsed. */
  | { type: 'tick' }
  /** Auto-capture turned off, pose changed, capture done, etc. */
  | { type: 'reset' };

export const initialAutoCaptureState: AutoCaptureState = {
  phase: 'idle',
  streak: 0,
};

export function autoCaptureReducer(
  state: AutoCaptureState,
  event: AutoCaptureEvent,
): AutoCaptureState {
  switch (event.type) {
    case 'reset':
      return initialAutoCaptureState;
    case 'analysis':
      if (state.phase === 'capture') {
        return state;
      }
      if (!event.ready) {
        return initialAutoCaptureState;
      }
      if (state.phase === 'countdown') {
        return state;
      }
      if (state.streak + 1 >= REQUIRED_STREAK) {
        return { phase: 'countdown', count: COUNTDOWN_FROM };
      }
      return { phase: 'idle', streak: state.streak + 1 };
    case 'tick':
      if (state.phase !== 'countdown') {
        return state;
      }
      if (state.count <= 1) {
        return { phase: 'capture' };
      }
      return { phase: 'countdown', count: state.count - 1 };
    default:
      return state;
  }
}
