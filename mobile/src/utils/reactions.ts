import type { Photo, Reaction, User } from '../api/types';

/** My current reaction emoji on a photo, or null. */
export function myReaction(photo: Photo, me: User | null): string | null {
  if (!me) {
    return null;
  }
  return photo.reactions.find(r => r.user.id === me.id)?.emoji ?? null;
}

/** Optimistic update: one reaction per user; same emoji again removes it. */
export function applyReaction(photo: Photo, me: User, emoji: string): Photo {
  const current = myReaction(photo, me);
  const others = photo.reactions.filter(r => r.user.id !== me.id);
  if (current === emoji) {
    return { ...photo, reactions: others };
  }
  const mine: Reaction = {
    user: me,
    emoji,
    created_at: new Date().toISOString(),
  };
  return { ...photo, reactions: [...others, mine] };
}

/** Emoji counts in first-seen order, e.g. [["❤️", 2], ["😂", 1]]. */
export function reactionCounts(reactions: Reaction[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  }
  return Array.from(counts.entries());
}
