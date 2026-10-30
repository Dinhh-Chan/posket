import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { errorMessage } from '../api/errors';
import type { Photo } from '../api/types';
import { Avatar } from '../components/Avatar';
import { IconButton } from '../components/IconButton';
import { PillButton } from '../components/Pill';
import { ReactionBar } from '../components/ReactionBar';
import { getPose } from '../pose/poseLibrary';
import { useAuthImageSource, useSession } from '../state/SessionContext';
import { colors, radii, spacing } from '../theme';
import { applyReaction, myReaction } from '../utils/reactions';
import { relativeTime } from '../utils/time';

export interface FeedPageProps {
  photo: Photo;
  size: number;
  /** Render the image (pages far from the visible one only show a placeholder). */
  near: boolean;
  onPhotoChange: (photo: Photo) => void;
  onPhotoDeleted: (id: number) => void;
}

/** One history page: square photo, caption, sender + time, pose badge, reactions. */
export function FeedPage({
  photo,
  size,
  near,
  onPhotoChange,
  onPhotoDeleted,
}: FeedPageProps) {
  const { api, user } = useSession();
  const source = useAuthImageSource();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const pose = getPose(photo.pose_id);

  const react = async (emoji: string) => {
    if (!user || busy) {
      return;
    }
    const previous = photo;
    const removing = myReaction(photo, user) === emoji;
    onPhotoChange(applyReaction(photo, user, emoji));
    setBusy(true);
    try {
      const updated = removing
        ? await api.unreact(photo.id)
        : await api.react(photo.id, emoji);
      onPhotoChange(updated);
    } catch (e) {
      onPhotoChange(previous);
      Alert.alert('Không thả được cảm xúc', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Xoá ảnh này?', 'Bạn bè sẽ không còn thấy ảnh này nữa.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePhoto(photo.id);
            onPhotoDeleted(photo.id);
          } catch (e) {
            Alert.alert('Không xoá được ảnh', errorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <View style={[styles.photo, { width: size, height: size }]}>
        {near ? (
          <Image
            source={source(photo.image_url)}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => setLoaded(true)}
          />
        ) : null}
        {!loaded ? (
          <View style={styles.placeholder} pointerEvents="none">
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : null}
        {photo.caption ? (
          <View style={styles.captionWrap} pointerEvents="none">
            <Text style={styles.caption}>{photo.caption}</Text>
          </View>
        ) : null}
        {pose ? (
          <View style={styles.poseBadge} pointerEvents="none">
            <Text style={styles.poseText} numberOfLines={1}>
              Dáng: {pose.name}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.meta}>
        <Avatar user={photo.sender} size={30} />
        <Text style={styles.sender} numberOfLines={1}>
          {photo.is_mine ? 'Bạn' : photo.sender.display_name}
        </Text>
        <Text style={styles.time}>{relativeTime(photo.created_at)}</Text>
        {photo.is_mine ? (
          <IconButton
            icon="trash"
            onPress={confirmDelete}
            accessibilityLabel="Xoá ảnh"
            size={34}
            variant="plain"
            color={colors.textSecondary}
          />
        ) : null}
      </View>

      <View style={styles.bottom}>
        <ReactionBar photo={photo} me={user} onReact={react} disabled={busy} />
      </View>
    </View>
  );
}

export function EmptyFeedPage({
  size,
  loading,
  error,
  onRetry,
  onAddFriends,
  onBackToCamera,
}: {
  size: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAddFriends: () => void;
  onBackToCamera: () => void;
}) {
  return (
    <View style={styles.page}>
      <View style={[styles.photo, styles.empty, { width: size, height: size }]}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : error ? (
          <>
            <Text style={styles.emptyEmoji}>📡</Text>
            <Text style={styles.emptyTitle}>Không tải được lịch sử</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </>
        ) : (
          <>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>Chưa có ảnh nào</Text>
            <Text style={styles.emptyText}>
              Chụp một tấm gửi bạn bè, hoặc kết bạn để xem ảnh của họ ở đây.
            </Text>
          </>
        )}
      </View>
      <View style={styles.emptyActions}>
        {error ? (
          <PillButton label="Thử lại" onPress={onRetry} />
        ) : (
          <PillButton label="Thêm bạn bè" onPress={onAddFriends} />
        )}
        <PillButton
          label="Về camera"
          variant="surface"
          onPress={onBackToCamera}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center' },
  photo: {
    borderRadius: radii.viewfinder,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    alignItems: 'center',
  },
  caption: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    textAlign: 'center',
  },
  poseBadge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    maxWidth: '80%',
    backgroundColor: colors.glass,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  poseText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    maxWidth: '100%',
  },
  sender: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  time: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  bottom: { flex: 1, width: '100%', justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyActions: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
