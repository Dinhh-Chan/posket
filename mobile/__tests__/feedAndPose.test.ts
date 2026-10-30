import type { Photo, PoseMatch, User } from '../src/api/types';
import { suggestionItems } from '../src/components/PoseSheet';
import { toggleRecipient } from '../src/components/RecipientRow';
import { mergeFeed } from '../src/hooks/useFeed';
import {
  displayScore,
  statusMessage,
  visibleHints,
} from '../src/pose/feedback';
import { getPose } from '../src/pose/poseLibrary';
import {
  applyReaction,
  myReaction,
  reactionCounts,
} from '../src/utils/reactions';
import { passwordError, usernameError } from '../src/utils/validation';

const me: User = {
  id: 1,
  username: 'me',
  display_name: 'Tôi',
  avatar_url: null,
};
const linh: User = {
  id: 2,
  username: 'linh',
  display_name: 'Linh',
  avatar_url: null,
};

function photo(id: number, partial: Partial<Photo> = {}): Photo {
  return {
    id,
    sender: linh,
    image_url: `/media/photos/${id}`,
    width: 1080,
    height: 1080,
    caption: null,
    pose_id: null,
    created_at: '2026-10-30T15:04:05Z',
    is_mine: false,
    reactions: [],
    ...partial,
  };
}

describe('mergeFeed', () => {
  it('puts the fresh first page on top and keeps older loaded photos', () => {
    const existing = [photo(8), photo(7), photo(5), photo(3)];
    const fresh = [photo(10), photo(9), photo(8), photo(7)];
    expect(mergeFeed(fresh, existing).map(p => p.id)).toEqual([
      10, 9, 8, 7, 5, 3,
    ]);
  });
});

describe('reactions', () => {
  it('adds, replaces and toggles my reaction', () => {
    const p = photo(1, {
      reactions: [{ user: linh, emoji: '😂', created_at: '' }],
    });
    const withHeart = applyReaction(p, me, '❤️');
    expect(myReaction(withHeart, me)).toBe('❤️');
    expect(withHeart.reactions).toHaveLength(2);
    const replaced = applyReaction(withHeart, me, '🔥');
    expect(myReaction(replaced, me)).toBe('🔥');
    expect(replaced.reactions).toHaveLength(2);
    const removed = applyReaction(replaced, me, '🔥');
    expect(myReaction(removed, me)).toBeNull();
    expect(
      reactionCounts([
        ...withHeart.reactions,
        { user: me, emoji: '😂', created_at: '' },
      ]),
    ).toEqual([
      ['😂', 2],
      ['❤️', 1],
    ]);
  });
});

describe('recipients', () => {
  it('toggles friends; empty selection means everyone', () => {
    expect(toggleRecipient([], 3)).toEqual([3]);
    expect(toggleRecipient([3, 4], 3)).toEqual([4]);
  });
});

describe('pose feedback', () => {
  const pose = getPose('duo-heart');
  const base: PoseMatch = {
    pose_id: 'duo-heart',
    status: 'ok',
    score: 87.4,
    ready: true,
    limbs: [],
    hints: ['Giữ nguyên tư thế', '', 'x', 'y'],
  };

  it('shows the score only for ok / partial', () => {
    expect(displayScore(base)).toBe(87);
    expect(displayScore({ ...base, status: 'partial', score: 40 })).toBe(40);
    expect(
      displayScore({ ...base, status: 'no_person', score: null }),
    ).toBeNull();
  });

  it('keeps at most two non-empty hints', () => {
    expect(visibleHints(base)).toEqual(['Giữ nguyên tư thế', 'x']);
  });

  it('gives soft messages for no_person / wrong_count / partial', () => {
    expect(statusMessage({ ...base, status: 'no_person' }, pose)).toMatch(
      /2 người/,
    );
    expect(statusMessage({ ...base, status: 'wrong_count' }, pose)).toBe(
      'Dáng này cần 2 người trong khung',
    );
    expect(statusMessage({ ...base, status: 'partial' }, pose)).toMatch(/lùi/);
    expect(statusMessage(base, pose)).toBeNull();
  });
});

describe('Gợi ý tab', () => {
  it('uses backend suggestions with their reasons', () => {
    const { items, mode } = suggestionItems(
      [
        {
          pose_id: 'solo-arms-crossed',
          score: 0.8,
          reason: 'Phát hiện 1 người',
        },
        { pose_id: 'nope', score: 1, reason: '' },
      ],
      true,
      'solo',
    );
    expect(mode).toBe('server');
    expect(items.map(i => [i.pose.id, i.subtitle])).toEqual([
      ['solo-arms-crossed', 'Phát hiện 1 người'],
    ]);
  });

  it('falls back to the easiest library poses when the backend is unreachable', () => {
    const { items, mode } = suggestionItems([], false, 'selfie');
    expect(mode).toBe('offline');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.pose.category === 'selfie')).toBe(true);
    expect(items[0].pose.difficulty).toBe(1);
  });
});

describe('validation', () => {
  it('mirrors the backend username/password rules', () => {
    expect(usernameError('Linh.Nguyen')).toBeNull();
    expect(usernameError('ab')).not.toBeNull();
    expect(usernameError('lin h')).not.toBeNull();
    expect(usernameError('linh-nguyen')).not.toBeNull();
    expect(passwordError('12345')).not.toBeNull();
    expect(passwordError('123456')).toBeNull();
  });
});
