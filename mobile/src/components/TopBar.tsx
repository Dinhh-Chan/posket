import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { User } from '../api/types';
import { colors, radii, spacing } from '../theme';
import { Avatar } from './Avatar';

export const TOP_BAR_HEIGHT = 64;

export interface TopBarProps {
  user: User | null;
  friendCount: number;
  /** Incoming friend requests (red dot on the pill). */
  requestCount: number;
  onAvatarPress: () => void;
  onFriendsPress: () => void;
  right?: React.ReactNode;
}

/** Avatar · "👥 N bạn bè" pill · action, as on Locket's main screen. */
export function TopBar({
  user,
  friendCount,
  requestCount,
  onAvatarPress,
  onFriendsPress,
  right,
}: TopBarProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="Hồ sơ"
        hitSlop={8}
        style={styles.side}
      >
        <View style={styles.avatarWrap}>
          <Avatar user={user} size={44} />
        </View>
      </Pressable>
      <Pressable
        onPress={onFriendsPress}
        accessibilityRole="button"
        accessibilityLabel="Bạn bè"
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <Text style={styles.pillText}>👥 {friendCount} bạn bè</Text>
        {requestCount > 0 ? (
          <View style={styles.dot}>
            <Text style={styles.dotText}>{requestCount}</Text>
          </View>
        ) : null}
      </Pressable>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  side: { width: 52 },
  right: { alignItems: 'flex-end' },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    height: 44,
    gap: 8,
  },
  pillText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  dotText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
