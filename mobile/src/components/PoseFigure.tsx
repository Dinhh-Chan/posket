import React, { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import type { PoseMatch } from '../api/types';
import {
  HEAD_LIMB_ID,
  guideDash,
  headToPixel,
  limbColor,
  limbSegments,
  limbStrokeWidth,
  neckSegment,
  targetColor,
} from '../pose/geometry';
import { library } from '../pose/poseLibrary';
import type { Pose, PoseGuide, PosePerson } from '../pose/types';

const WHITE = '#FFFFFF';
/** Soft dark halo under the strokes so the ghost stays visible on bright scenes. */
const OUTLINE = 'rgba(0,0,0,0.22)';

interface PersonStrokesProps {
  person: PosePerson;
  size: number;
  width: number;
  /** Stroke colour per limb id ("head" = neck + head circle). */
  colorFor: (limbId: string) => string;
}

function PersonStrokes({ person, size, width, colorFor }: PersonStrokesProps) {
  const neck = neckSegment(person, size);
  const head = person.head ? headToPixel(person.head, size) : null;
  const headColor = colorFor(HEAD_LIMB_ID);
  return (
    <>
      {limbSegments(person, library.limbs, size).map(seg => (
        <Line
          key={seg.limbId}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={colorFor(seg.limbId)}
          strokeWidth={width}
          strokeLinecap="round"
        />
      ))}
      {neck ? (
        <Line
          x1={neck.x1}
          y1={neck.y1}
          x2={neck.x2}
          y2={neck.y2}
          stroke={headColor}
          strokeWidth={width}
          strokeLinecap="round"
        />
      ) : null}
      {head ? (
        <Circle
          cx={head.cx}
          cy={head.cy}
          r={Math.max(1, head.r - limbStrokeWidth(size) / 2)}
          fill="none"
          stroke={headColor}
          strokeWidth={width}
        />
      ) : null}
    </>
  );
}

export interface PoseFigureProps {
  pose: Pose;
  /** Side of the square in px. */
  size: number;
  /** Latest live match: colours limbs green/red and targets green. */
  match?: PoseMatch | null;
  /** Opacity of the figure strokes (overlay on camera ≈ 0.8, thumbnails 1). */
  figureOpacity?: number;
  /** Opacity of dashed guides (API.md: 0.6). */
  guideOpacity?: number;
  /** Draw a dark halo under the figure (camera overlay). */
  outline?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface GuideProps {
  guide: PoseGuide;
  size: number;
  targetOrdinal: number;
  match?: PoseMatch | null;
  opacity: number;
}

function GuideShape({
  guide,
  size,
  targetOrdinal,
  match,
  opacity,
}: GuideProps) {
  const stroke = Math.max(1, size * 0.008);
  const dash = guideDash(size);
  switch (guide.type) {
    case 'line':
      return (
        <Line
          x1={guide.x1 * size}
          y1={guide.y1 * size}
          x2={guide.x2 * size}
          y2={guide.y2 * size}
          stroke={WHITE}
          strokeOpacity={opacity}
          strokeWidth={stroke}
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      );
    case 'rect':
      return (
        <Rect
          x={guide.x * size}
          y={guide.y * size}
          width={guide.w * size}
          height={guide.h * size}
          fill="none"
          stroke={WHITE}
          strokeOpacity={opacity}
          strokeWidth={stroke}
          strokeDasharray={dash}
        />
      );
    case 'ellipse':
      return (
        <Ellipse
          cx={guide.cx * size}
          cy={guide.cy * size}
          rx={guide.rx * size}
          ry={guide.ry * size}
          fill="none"
          stroke={WHITE}
          strokeOpacity={opacity}
          strokeWidth={stroke}
          strokeDasharray={dash}
        />
      );
    case 'target': {
      const color = targetColor(match, targetOrdinal);
      const r = guide.r * size;
      return (
        <G>
          <Circle
            cx={guide.cx * size}
            cy={guide.cy * size}
            r={r}
            fill={color}
            fillOpacity={0.12}
            stroke={color}
            strokeOpacity={Math.min(1, opacity + 0.3)}
            strokeWidth={stroke * 1.6}
            strokeDasharray={dash}
          />
          {guide.label ? (
            <SvgText
              x={guide.cx * size}
              y={guide.cy * size + r * 0.32}
              fontSize={Math.max(8, r * 0.9)}
              fontWeight="800"
              fill={color}
              textAnchor="middle"
            >
              {guide.label}
            </SvgText>
          ) : null}
        </G>
      );
    }
    default:
      return null;
  }
}

/**
 * Draws a pose from the library (guides, targets, persons) in a square of side
 * `size`, following the rendering rules of docs/API.md.
 */
function PoseFigureImpl({
  pose,
  size,
  match,
  figureOpacity = 1,
  guideOpacity = 0.6,
  outline = false,
  style,
}: PoseFigureProps) {
  if (size <= 0) {
    return null;
  }
  const width = limbStrokeWidth(size);
  const activeMatch = match && match.pose_id === pose.id ? match : null;
  let targetOrdinal = -1;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={style}
    >
      {pose.guides.map((guide, i) => {
        if (guide.type === 'target') {
          targetOrdinal += 1;
        }
        return (
          <GuideShape
            key={`g${i}`}
            guide={guide}
            size={size}
            targetOrdinal={targetOrdinal}
            match={activeMatch}
            opacity={guideOpacity}
          />
        );
      })}
      {pose.persons.map((person, p) => (
        <G key={`p${p}`} opacity={figureOpacity}>
          {outline ? (
            <PersonStrokes
              person={person}
              size={size}
              width={width * 1.45}
              colorFor={() => OUTLINE}
            />
          ) : null}
          <PersonStrokes
            person={person}
            size={size}
            width={width}
            colorFor={limbId => limbColor(activeMatch, p, limbId) ?? WHITE}
          />
        </G>
      ))}
    </Svg>
  );
}

export const PoseFigure = memo(PoseFigureImpl);
