import type { PoseMatch } from '../src/api/types';
import {
  HEAD_LIMB_ID,
  LIMB_BAD_COLOR,
  LIMB_OK_COLOR,
  TARGET_COLOR,
  fitWithin,
  headToPixel,
  limbColor,
  limbSegments,
  limbStrokeWidth,
  neckSegment,
  targetColor,
  toPixel,
  viewfinderSize,
} from '../src/pose/geometry';
import { easiestPoses, getPose, library } from '../src/pose/poseLibrary';
import type { PoseKeypoint, PosePerson } from '../src/pose/types';

function person(
  points: Record<number, [number, number]>,
  head: PosePerson['head'],
): PosePerson {
  const keypoints: PoseKeypoint[] = Array.from(
    { length: 17 },
    (_, i) => points[i] ?? null,
  );
  return { keypoints, head };
}

function match(partial: Partial<PoseMatch>): PoseMatch {
  return {
    pose_id: 'p',
    status: 'ok',
    score: 80,
    ready: false,
    limbs: [],
    hints: [],
    ...partial,
  };
}

describe('normalised → pixel mapping', () => {
  it('scales by the square side', () => {
    expect(toPixel([0.5, 0.25], 400)).toEqual({ x: 200, y: 100 });
    expect(toPixel([0, 1], 387)).toEqual({ x: 0, y: 387 });
    expect(headToPixel({ cx: 0.5, cy: 0.2, r: 0.05 }, 400)).toEqual({
      cx: 200,
      cy: 80,
      r: 20,
    });
  });

  it('uses a limb width of 2.8% of the side', () => {
    expect(limbStrokeWidth(1000)).toBeCloseTo(28);
    expect(limbStrokeWidth(10)).toBe(1); // never thinner than 1px
  });

  it('computes the viewfinder square and resize targets', () => {
    expect(viewfinderSize(411, 12)).toBe(387);
    expect(fitWithin(1016, 1016, 640)).toEqual({ width: 640, height: 640 });
    expect(fitWithin(1920, 1080, 640)).toEqual({ width: 640, height: 360 });
    expect(fitWithin(500, 300, 640)).toEqual({ width: 500, height: 300 });
  });
});

describe('limb segments', () => {
  it('draws only limbs whose two keypoints exist', () => {
    // shoulders (5, 6) and left elbow (7); no wrists, no hips.
    const p = person({ 5: [0.4, 0.3], 6: [0.6, 0.3], 7: [0.35, 0.45] }, null);
    const segs = limbSegments(p, library.limbs, 100);
    expect(segs.map(s => s.limbId).sort()).toEqual([
      'left_upper_arm',
      'shoulders',
    ]);
    const arm = segs.find(s => s.limbId === 'left_upper_arm');
    expect(arm?.x1).toBeCloseTo(40);
    expect(arm?.y1).toBeCloseTo(30);
    expect(arm?.x2).toBeCloseTo(35);
    expect(arm?.y2).toBeCloseTo(45);
  });

  it('handles selfie poses with null legs from the library', () => {
    const selfie = getPose('selfie-center');
    expect(selfie).toBeDefined();
    const segs = limbSegments(selfie!.persons[0], library.limbs, 300);
    expect(segs.some(s => s.limbId === 'left_shin')).toBe(false);
    expect(segs.some(s => s.limbId === 'shoulders')).toBe(true);
  });
});

describe('head / neck', () => {
  it('runs from the shoulder midpoint to the edge of the head circle', () => {
    const p = person(
      { 5: [0.4, 0.4], 6: [0.6, 0.4] },
      { cx: 0.5, cy: 0.2, r: 0.05 },
    );
    const neck = neckSegment(p, 100);
    expect(neck).not.toBeNull();
    expect(neck!.x1).toBeCloseTo(50);
    expect(neck!.y1).toBeCloseTo(40);
    // head centre (50, 20), radius 5 → bottom of the circle
    expect(neck!.x2).toBeCloseTo(50);
    expect(neck!.y2).toBeCloseTo(25);
  });

  it('is null without both shoulders or a head', () => {
    expect(
      neckSegment(
        person({ 5: [0.4, 0.4] }, { cx: 0.5, cy: 0.2, r: 0.05 }),
        100,
      ),
    ).toBeNull();
    expect(
      neckSegment(person({ 5: [0.4, 0.4], 6: [0.6, 0.4] }, null), 100),
    ).toBeNull();
  });

  it('is null when the shoulder midpoint lies inside the head', () => {
    const p = person(
      { 5: [0.49, 0.2], 6: [0.51, 0.2] },
      { cx: 0.5, cy: 0.2, r: 0.05 },
    );
    expect(neckSegment(p, 100)).toBeNull();
  });
});

describe('limb colouring by match', () => {
  const m = match({
    limbs: [
      { person: 0, limb: 'left_upper_arm', ok: true, score: 0.9 },
      { person: 0, limb: 'right_forearm', ok: false, score: 0.3 },
      { person: 1, limb: 'left_upper_arm', ok: false, score: 0.2 },
      { person: 0, limb: HEAD_LIMB_ID, ok: true, score: 0.95 },
    ],
  });

  it('is green when ok, red when not', () => {
    expect(limbColor(m, 0, 'left_upper_arm')).toBe(LIMB_OK_COLOR);
    expect(limbColor(m, 0, 'right_forearm')).toBe(LIMB_BAD_COLOR);
    expect(limbColor(m, 1, 'left_upper_arm')).toBe(LIMB_BAD_COLOR);
    expect(LIMB_OK_COLOR).toBe('#4ADE80');
    expect(LIMB_BAD_COLOR).toBe('#F87171');
  });

  it('colours the head/neck with the "head" limb', () => {
    expect(limbColor(m, 0, HEAD_LIMB_ID)).toBe(LIMB_OK_COLOR);
    expect(limbColor(m, 1, HEAD_LIMB_ID)).toBeNull();
  });

  it('stays white (null) for limbs absent from the match or without a match', () => {
    expect(limbColor(m, 0, 'left_shin')).toBeNull();
    expect(limbColor(null, 0, 'left_upper_arm')).toBeNull();
  });

  it('colours targets green when ok, yellow otherwise', () => {
    const t = match({
      targets: [
        { index: 0, label: '1', ok: true, score: 0.97 },
        { index: 1, label: '2', ok: false, score: 0.4 },
      ],
    });
    expect(targetColor(t, 0)).toBe(LIMB_OK_COLOR);
    expect(targetColor(t, 1)).toBe(TARGET_COLOR);
    expect(targetColor(t, 2)).toBe(TARGET_COLOR);
    expect(targetColor(null, 0)).toBe(TARGET_COLOR);
  });
});

describe('pose library', () => {
  it('loads the bundled library', () => {
    expect(library.poses.length).toBeGreaterThanOrEqual(40);
    expect(library.limbs).toHaveLength(12);
    expect(library.categories.map(c => c.id)).toContain('selfie');
    for (const pose of library.poses) {
      if (pose.kind === 'body') {
        expect(pose.persons).toHaveLength(pose.people);
        pose.persons.forEach(p => expect(p.keypoints).toHaveLength(17));
      }
    }
  });

  it('lists the easiest poses of a category first', () => {
    const easy = easiestPoses('solo', 4);
    expect(easy).toHaveLength(4);
    expect(easy.every(p => p.category === 'solo')).toBe(true);
    const difficulties = easy.map(p => p.difficulty);
    expect([...difficulties].sort()).toEqual(difficulties);
  });
});
