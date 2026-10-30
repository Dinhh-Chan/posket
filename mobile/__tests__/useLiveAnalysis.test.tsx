import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { ApiClient } from '../src/api/client';
import type { AnalyzeInput, AnalyzeResult } from '../src/api/types';
import {
  type LiveAnalysis,
  useLiveAnalysis,
} from '../src/hooks/useLiveAnalysis';

const { act } = ReactTestRenderer;

function result(poseId: string | null): AnalyzeResult {
  return {
    persons: [],
    objects: [],
    scene: { kind: 'solo', person_count: 1, object_count: 0 },
    suggestions: [],
    match: poseId
      ? {
          pose_id: poseId,
          status: 'ok',
          score: 90,
          ready: true,
          limbs: [],
          hints: [],
        }
      : null,
    elapsed_ms: 5,
  };
}

const wait = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

function setup(latencyMs: number) {
  let inFlight = 0;
  let maxInFlight = 0;
  const calls: AnalyzeInput[] = [];
  const analyze = jest.fn(async (input: AnalyzeInput) => {
    calls.push(input);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await wait(latencyMs);
    inFlight -= 1;
    return result(input.poseId ?? null);
  });
  const api = { analyze } as unknown as ApiClient;
  const takeSnapshot = jest.fn(async () => ({
    uri: 'file:///frame.jpg',
    mirror: false,
  }));
  const state: { current: LiveAnalysis | null } = { current: null };
  function Probe(props: { enabled: boolean; poseId: string | null }) {
    state.current = useLiveAnalysis({
      ...props,
      api,
      takeSnapshot,
      intervalMs: 20,
    });
    return null;
  }
  return {
    Probe,
    state,
    calls,
    analyze,
    getMaxInFlight: () => maxInFlight,
  };
}

describe('useLiveAnalysis', () => {
  it('never overlaps requests even when the server is slower than the interval', async () => {
    const t = setup(60);
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <t.Probe enabled poseId="solo-confident" />,
      );
    });
    await act(async () => {
      await wait(400);
    });
    expect(t.analyze.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(t.getMaxInFlight()).toBe(1);
    expect(t.calls[0]).toMatchObject({
      poseId: 'solo-confident',
      mirror: false,
      file: { uri: 'file:///frame.jpg' },
    });
    expect(t.state.current?.result?.match?.pose_id).toBe('solo-confident');
    expect(t.state.current?.reachable).toBe(true);

    // Changing the pose restarts the loop without overlapping the old request.
    await act(async () => {
      renderer?.update(<t.Probe enabled poseId="solo-wave" />);
    });
    await act(async () => {
      await wait(300);
    });
    expect(t.getMaxInFlight()).toBe(1);
    expect(t.calls[t.calls.length - 1].poseId).toBe('solo-wave');
    expect(t.state.current?.result?.match?.pose_id).toBe('solo-wave');

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('stops when disabled', async () => {
    const t = setup(5);
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      renderer = ReactTestRenderer.create(<t.Probe enabled poseId={null} />);
    });
    await act(async () => {
      await wait(120);
    });
    await act(async () => {
      renderer?.update(<t.Probe enabled={false} poseId={null} />);
    });
    await act(async () => {
      await wait(50);
    });
    const count = t.analyze.mock.calls.length;
    expect(count).toBeGreaterThan(0);
    await act(async () => {
      await wait(200);
    });
    expect(t.analyze.mock.calls.length).toBe(count);
    await act(async () => {
      renderer?.unmount();
    });
  });
});
