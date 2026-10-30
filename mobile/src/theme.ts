import { Platform } from 'react-native';

/** Locket-like dark design tokens. */
export const colors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceHigh: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  accent: '#FFC93C',
  success: '#4ADE80',
  error: '#F87171',
  overlay: 'rgba(0,0,0,0.55)',
  scrim: 'rgba(0,0,0,0.6)',
  glass: 'rgba(28,28,30,0.72)',
  hairline: 'rgba(255,255,255,0.12)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  pill: 999,
  card: 20,
  viewfinder: 44,
  sheet: 28,
} as const;

export const fontFamily = Platform.select({
  ios: 'System',
  default: undefined,
});

export const typography = {
  hero: { fontSize: 40, fontWeight: '800' as const, color: colors.text },
  title: { fontSize: 24, fontWeight: '800' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '800' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  label: { fontSize: 14, fontWeight: '700' as const, color: colors.text },
  caption: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.textSecondary,
  },
};

/** Colour for a 0..100 pose-match score. */
export function scoreColor(score: number): string {
  if (score >= 85) {
    return colors.success;
  }
  if (score >= 60) {
    return colors.accent;
  }
  return colors.error;
}
