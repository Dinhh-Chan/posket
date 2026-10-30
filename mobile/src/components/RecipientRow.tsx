import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { User } from '../api/types';
import { colors, spacing } from '../theme';
import { Avatar } from './Avatar';
import { Pill } from './Pill';

export interface RecipientRowProps {
  friends: User[];
  /** Selected friend ids; empty = "Tất cả". */
  selected: number[];
  onChange: (ids: number[]) => void;
  /** Shown next to "Tất cả" when there are no friends yet. */
  onAddFriends?: () => void;
}

/** Toggle one id; an empty selection means everyone. */
export function toggleRecipient(selected: number[], id: number): number[] {
  return selected.includes(id)
    ? selected.filter(x => x !== id)
    : [...selected, id];
}

const SIZE = 52;

/** "Tất cả" + friend avatars, multi-select (Locket send row). */
export function RecipientRow({
  friends,
  selected,
  onChange,
  onAddFriends,
}: RecipientRowProps) {
  const all = selected.length === 0;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => onChange([])}
        style={styles.item}
        accessibilityRole="button"
        accessibilityState={{ selected: all }}
        accessibilityLabel="Gửi tất cả bạn bè"
      >
        <View style={[styles.allCircle, all && styles.ringOn]}>
          <Text style={styles.allEmoji}>👥</Text>
        </View>
        <Text style={[styles.name, all && styles.nameOn]}>Tất cả</Text>
      </Pressable>
      {friends.map(friend => {
        const on = selected.includes(friend.id);
        return (
          <Pressable
            key={friend.id}
            onPress={() => onChange(toggleRecipient(selected, friend.id))}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Gửi cho ${friend.display_name}`}
          >
            <Avatar user={friend} size={SIZE} ring={on} />
            <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
              {friend.display_name}
            </Text>
          </Pressable>
        );
      })}
      {friends.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>Chưa có bạn bè để gửi ảnh</Text>
          {onAddFriends ? (
            <Pill
              small
              variant="accent"
              label="Thêm bạn bè"
              onPress={onAddFriends}
              style={styles.emptyButton}
            />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  item: { alignItems: 'center', width: 64, gap: 6 },
  allCircle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  ringOn: { borderColor: colors.accent },
  allEmoji: { fontSize: 22 },
  name: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 64,
  },
  nameOn: { color: colors.text },
  emptyBox: { height: SIZE, justifyContent: 'center', gap: 6 },
  empty: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  emptyButton: { alignSelf: 'flex-start' },
});
