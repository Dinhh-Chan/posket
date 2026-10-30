import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { User } from '../api/types';
import { useAuthImageSource } from '../state/SessionContext';
import { colors } from '../theme';

const PALETTE = [
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#EC4899',
  '#8B5CF6',
  '#EF4444',
  '#14B8A6',
  '#F97316',
];

/** Up to two uppercase initials from a display name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export interface AvatarProps {
  user: Pick<User, 'id' | 'display_name' | 'avatar_url'> | null | undefined;
  size?: number;
  /** Yellow ring around the avatar (selected / me). */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ user, size = 40, ring, style }: AvatarProps) {
  const source = useAuthImageSource();
  const [failed, setFailed] = useState(false);
  const name = user?.display_name ?? '';
  const bg = PALETTE[Math.abs(user?.id ?? 0) % PALETTE.length];
  const imageSource = !failed ? source(user?.avatar_url) : undefined;
  const ringWidth = ring ? Math.max(2, size * 0.06) : 0;
  const inner = size - ringWidth * 2 - (ring ? 2 : 0);

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
        },
        ring && styles.ring,
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: bg,
          },
        ]}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: inner, height: inner, borderRadius: inner / 2 }}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text
            style={[styles.initials, { fontSize: Math.max(10, inner * 0.38) }]}
          >
            {initials(name)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
  },
  ring: { borderColor: colors.accent },
  inner: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: '#fff', fontWeight: '800' },
});
