import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline } from 'react-native-svg';
import { colors } from '../theme';

export type IconName =
  | 'bolt'
  | 'flip'
  | 'send'
  | 'close'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'pose'
  | 'copy'
  | 'share'
  | 'search'
  | 'userPlus'
  | 'check'
  | 'camera'
  | 'trash';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Fill the shape (e.g. flash on). */
  filled?: boolean;
  strokeWidth?: number;
}

/** Small stroke icon set (24×24 grid) drawn with react-native-svg. */
export function Icon({
  name,
  size = 24,
  color = colors.text,
  filled = false,
  strokeWidth = 2.2,
}: IconProps) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  let content: React.ReactNode = null;
  switch (name) {
    case 'bolt':
      content = (
        <Polygon
          {...common}
          fill={filled ? color : 'none'}
          points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"
        />
      );
      break;
    case 'flip':
      content = (
        <>
          <Polyline {...common} points="23 4 23 10 17 10" />
          <Polyline {...common} points="1 20 1 14 7 14" />
          <Path
            {...common}
            d="M3.5 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
          />
        </>
      );
      break;
    case 'send':
      content = (
        <>
          <Line {...common} x1="22" y1="2" x2="11" y2="13" />
          <Polygon
            {...common}
            fill={filled ? color : 'none'}
            points="22 2 15 22 11 13 2 9 22 2"
          />
        </>
      );
      break;
    case 'close':
      content = (
        <>
          <Line {...common} x1="18" y1="6" x2="6" y2="18" />
          <Line {...common} x1="6" y1="6" x2="18" y2="18" />
        </>
      );
      break;
    case 'chevronDown':
      content = <Polyline {...common} points="6 9 12 15 18 9" />;
      break;
    case 'chevronLeft':
      content = <Polyline {...common} points="15 18 9 12 15 6" />;
      break;
    case 'chevronRight':
      content = <Polyline {...common} points="9 18 15 12 9 6" />;
      break;
    case 'pose':
      content = (
        <>
          <Circle {...common} cx="12" cy="4.5" r="2.5" />
          <Polyline {...common} points="4 7 8.5 10 15.5 10 20 6" />
          <Polyline {...common} points="8.5 10 9.5 15 7 22" />
          <Polyline {...common} points="15.5 10 14.5 15 17 22" />
          <Line {...common} x1="9.5" y1="15" x2="14.5" y2="15" />
        </>
      );
      break;
    case 'copy':
      content = (
        <>
          <Path {...common} d="M9 9h11v11H9z" />
          <Path {...common} d="M5 15H4V4h11v1" />
        </>
      );
      break;
    case 'share':
      content = (
        <>
          <Path {...common} d="M4 12v8h16v-8" />
          <Polyline {...common} points="16 6 12 2 8 6" />
          <Line {...common} x1="12" y1="2" x2="12" y2="15" />
        </>
      );
      break;
    case 'search':
      content = (
        <>
          <Circle {...common} cx="11" cy="11" r="7" />
          <Line {...common} x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      );
      break;
    case 'userPlus':
      content = (
        <>
          <Path {...common} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle {...common} cx="9" cy="7" r="4" />
          <Line {...common} x1="20" y1="8" x2="20" y2="14" />
          <Line {...common} x1="23" y1="11" x2="17" y2="11" />
        </>
      );
      break;
    case 'check':
      content = <Polyline {...common} points="20 6 9 17 4 12" />;
      break;
    case 'camera':
      content = (
        <>
          <Path
            {...common}
            d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
          />
          <Circle {...common} cx="12" cy="13" r="4" />
        </>
      );
      break;
    case 'trash':
      content = (
        <>
          <Polyline {...common} points="3 6 5 6 21 6" />
          <Path
            {...common}
            d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"
          />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {content}
    </Svg>
  );
}
