import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '../theme';
import { Icon } from './Icon';

const SIZE = 84;
const RING = 6;

export interface ShutterProps {
  onPress: () => void;
  /** Send mode: paper-plane button instead of the white disc. */
  mode?: 'capture' | 'send';
  busy?: boolean;
  disabled?: boolean;
}

/** Big round shutter: white disc inside a yellow ring (Locket style). */
export function Shutter({
  onPress,
  mode = 'capture',
  busy,
  disabled,
}: ShutterProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animate(0.9)}
      onPressOut={() => animate(1)}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={mode === 'send' ? 'Gửi ảnh' : 'Chụp ảnh'}
      hitSlop={10}
    >
      <View style={styles.ring}>
        <Animated.View
          style={[
            styles.disc,
            mode === 'send' && styles.sendDisc,
            { transform: [{ scale }] },
            disabled && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              color={mode === 'send' ? colors.text : colors.background}
            />
          ) : mode === 'send' ? (
            <Icon name="send" size={30} color={colors.text} strokeWidth={2.4} />
          ) : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: RING,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: SIZE - RING * 2 - 8,
    height: SIZE - RING * 2 - 8,
    borderRadius: SIZE,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisc: { backgroundColor: colors.surfaceHigh },
  disabled: { opacity: 0.5 },
});
