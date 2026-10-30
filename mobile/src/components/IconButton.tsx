import React from 'react';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  color?: string;
  filled?: boolean;
  /** Background: dark surface (default), translucent glass, or none. */
  variant?: 'surface' | 'glass' | 'plain' | 'accent';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round icon-only button. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 48,
  iconSize,
  color,
  filled,
  variant = 'surface',
  disabled,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'surface' && styles.surface,
        variant === 'glass' && styles.glass,
        variant === 'accent' && styles.accent,
        (pressed || disabled) && styles.pressed,
        style,
      ]}
    >
      <Icon
        name={icon}
        size={iconSize ?? Math.round(size * 0.5)}
        color={color ?? (variant === 'accent' ? '#000' : colors.text)}
        filled={filled}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  surface: { backgroundColor: colors.surfaceHigh },
  glass: { backgroundColor: colors.glass },
  accent: { backgroundColor: colors.accent },
  pressed: { opacity: 0.55 },
});
