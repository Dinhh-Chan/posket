import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Photo, User } from '../api/types';
import { REACTION_EMOJIS } from '../config';
import { colors, radii, spacing } from '../theme';
import { myReaction, reactionCounts } from '../utils/reactions';
import { Avatar } from './Avatar';

export interface ReactionBarProps {
  photo: Photo;
  me: User | null;
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

/** Emoji row for friends' photos (with counts), activity list for my own photos. */
export function ReactionBar({
  photo,
  me,
  onReact,
  disabled,
}: ReactionBarProps) {
  if (photo.is_mine) {
    if (photo.reactions.length === 0) {
      return (
        <View style={styles.activity}>
          <Text style={styles.muted}>Chưa có ai thả cảm xúc</Text>
        </View>
      );
    }
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.reactorsScroll}
        contentContainerStyle={styles.reactors}
      >
        {photo.reactions.map(r => (
          <View key={`${r.user.id}`} style={styles.reactor}>
            <Avatar user={r.user} size={32} />
            <Text style={styles.reactorName} numberOfLines={1}>
              {r.user.display_name}
            </Text>
            <Text style={styles.reactorEmoji}>{r.emoji}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  const mine = myReaction(photo, me);
  const counts = new Map(reactionCounts(photo.reactions));
  return (
    <View style={styles.bar}>
      {REACTION_EMOJIS.map(emoji => {
        const selected = mine === emoji;
        const count = counts.get(emoji) ?? 0;
        return (
          <Pressable
            key={emoji}
            onPress={() => onReact(emoji)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={selected ? `Bỏ ${emoji}` : `Thả ${emoji}`}
            style={({ pressed }) => [
              styles.emojiButton,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            {count > 0 ? <Text style={styles.count}>{count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 6,
    gap: 4,
  },
  emojiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    height: 48,
    gap: 2,
  },
  selected: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  pressed: { transform: [{ scale: 0.92 }] },
  emoji: { fontSize: 26 },
  count: { color: colors.text, fontSize: 13, fontWeight: '800' },
  activity: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  muted: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  reactorsScroll: { flexGrow: 0 },
  reactors: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  reactor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    gap: 8,
  },
  reactorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    maxWidth: 110,
  },
  reactorEmoji: { fontSize: 20 },
});
