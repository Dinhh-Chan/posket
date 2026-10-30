import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../theme';

export interface PillProps {
  label: string;
  onPress?: () => void;
  /** Visual style. */
  variant?: 'surface' | 'glass' | 'accent' | 'outline';
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  small?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Fully rounded label / chip, optionally pressable. */
export function Pill({
  label,
  onPress,
  variant = 'surface',
  left,
  right,
  style,
  textStyle,
  small,
  disabled,
  accessibilityLabel,
}: PillProps) {
  const content = (
    <>
      {left}
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          small && styles.textSmall,
          variant === 'accent' && styles.textAccent,
          textStyle,
        ]}
      >
        {label}
      </Text>
      {right}
    </>
  );
  const pillStyle = [
    styles.pill,
    small && styles.small,
    variantStyles[variant],
    style,
  ];
  if (!onPress) {
    return <View style={pillStyle}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      style={({ pressed }) => [
        pillStyle,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

export interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'accent' | 'surface' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Large full-width pill button (primary actions). */
export function PillButton({
  label,
  onPress,
  variant = 'accent',
  loading,
  disabled,
  style,
}: PillButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        variant === 'accent' && styles.buttonAccent,
        variant === 'surface' && styles.buttonSurface,
        variant === 'danger' && styles.buttonDanger,
        (pressed || inactive) && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'accent' ? '#000' : colors.text}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'accent' && styles.textAccent,
            variant === 'danger' && styles.textDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const variantStyles = StyleSheet.create({
  surface: { backgroundColor: colors.surfaceHigh },
  glass: { backgroundColor: colors.glass },
  accent: { backgroundColor: colors.accent },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    gap: 6,
    maxWidth: '100%',
  },
  small: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  text: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  textSmall: { fontSize: 13 },
  textAccent: { color: '#000' },
  textDanger: { color: colors.error },
  pressed: { opacity: 0.6 },
  button: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonAccent: { backgroundColor: colors.accent },
  buttonSurface: { backgroundColor: colors.surfaceHigh },
  buttonDanger: { backgroundColor: colors.surface },
  buttonText: { color: colors.text, fontSize: 17, fontWeight: '800' },
});
