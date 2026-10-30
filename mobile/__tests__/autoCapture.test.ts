import {
  COUNTDOWN_FROM,
  REQUIRED_STREAK,
  autoCaptureReducer,
  initialAutoCaptureState,
  type AutoCaptureEvent,
  type AutoCaptureState,
} from '../src/hooks/autoCapture';

function run(
  events: AutoCaptureEvent[],
  from: AutoCaptureState = initialAutoCaptureState,
) {
  return events.reduce(autoCaptureReducer, from);
}

const ready: AutoCaptureEvent = { type: 'analysis', ready: true };
const notReady: AutoCaptureEvent = { type: 'analysis', ready: false };
const tick: AutoCaptureEvent = { type: 'tick' };

describe('auto-capture decision logic', () => {
  it('needs 3 ready analyses in a row before counting down', () => {
    expect(REQUIRED_STREAK).toBe(3);
    expect(run([ready])).toEqual({ phase: 'idle', streak: 1 });
    expect(run([ready, ready])).toEqual({ phase: 'idle', streak: 2 });
    expect(run([ready, ready, ready])).toEqual({
      phase: 'countdown',
      count: COUNTDOWN_FROM,
    });
  });

  it('resets the streak when readiness drops', () => {
    expect(run([ready, ready, notReady])).toEqual({ phase: 'idle', streak: 0 });
    expect(run([ready, ready, notReady, ready, ready])).toEqual({
      phase: 'idle',
      streak: 2,
    });
  });

  it('counts 3-2-1 then captures', () => {
    const counting = run([ready, ready, ready]);
    expect(run([tick], counting)).toEqual({ phase: 'countdown', count: 2 });
    expect(run([tick, tick], counting)).toEqual({
      phase: 'countdown',
      count: 1,
    });
    expect(run([tick, tick, tick], counting)).toEqual({ phase: 'capture' });
  });

  it('keeps counting while still ready', () => {
    const counting = run([ready, ready, ready]);
    expect(run([ready, tick, ready], counting)).toEqual({
      phase: 'countdown',
      count: 2,
    });
  });

  it('cancels the countdown if readiness drops', () => {
    const counting = run([ready, ready, ready, tick]);
    expect(run([notReady], counting)).toEqual({ phase: 'idle', streak: 0 });
  });

  it('ignores ticks when not counting and resets on demand', () => {
    expect(run([tick, tick])).toEqual(initialAutoCaptureState);
    expect(run([ready, ready, ready, { type: 'reset' }])).toEqual(
      initialAutoCaptureState,
    );
  });

  it('stays in capture until reset', () => {
    const captured = run([ready, ready, ready, tick, tick, tick]);
    expect(run([ready, notReady, tick], captured)).toEqual({
      phase: 'capture',
    });
    expect(run([{ type: 'reset' }], captured)).toEqual(initialAutoCaptureState);
  });
});
