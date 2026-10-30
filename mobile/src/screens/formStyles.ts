import { StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../theme';

export const formStyles = StyleSheet.create({
  error: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
  success: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
});
