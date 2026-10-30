import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Photo } from '../api/types';
import { IconButton } from '../components/IconButton';
import { TOP_BAR_HEIGHT, TopBar } from '../components/TopBar';
import { useFeed } from '../hooks/useFeed';
import { useFriends } from '../hooks/useFriends';
import { widget } from '../native';
import type { ScreenProps } from '../navigation';
import { viewfinderSize } from '../pose/geometry';
import type { Pose } from '../pose/types';
import { useSession } from '../state/SessionContext';
import { colors, spacing } from '../theme';
import { CameraPage } from './CameraPage';
import { EmptyFeedPage, FeedPage } from './FeedPage';

const VIEWFINDER_MARGIN = 12;

/** Vertical pager: page 0 = camera, pages 1..n = history (swipe up, like Locket). */
export function MainScreen({ navigation }: ScreenProps<'Main'>) {
  const { api, user } = useSession();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  const [sendMode, setSendMode] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [poseActive, setPoseActive] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  const feed = useFeed(api, isFocused && page > 0);
  const friends = useFriends(api);
  const size = viewfinderSize(width, VIEWFINDER_MARGIN);

  // Friends may have changed on the Friends screen.
  const reloadFriends = friends.reload;
  useFocusEffect(
    useCallback(() => {
      reloadFriends().catch(() => {});
    }, [reloadFriends]),
  );

  // Keep the widget fresh whenever the app is opened on this screen.
  useEffect(() => {
    widget.refresh();
  }, []);

  const goTo = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
  }, []);

  // Hardware back on a history page returns to the camera.
  useEffect(() => {
    if (!isFocused || page === 0) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goTo(0);
      return true;
    });
    return () => sub.remove();
  }, [isFocused, page, goTo]);

  const { items, hasMore, loadMore, replacePhoto, removePhoto } = feed;
  useEffect(() => {
    if (page > 0 && hasMore && page >= items.length - 2) {
      loadMore().catch(() => {});
    }
  }, [page, items.length, hasMore, loadMore]);

  const onPoseChange = useCallback(
    (pose: Pose | null) => setPoseActive(pose !== null),
    [],
  );
  const onPhotoDeleted = useCallback(
    (id: number) => {
      removePhoto(id);
    },
    [removePhoto],
  );
  const onPhotoChange = useCallback(
    (photo: Photo) => replacePhoto(photo),
    [replacePhoto],
  );

  const pageStyle = [
    styles.page,
    {
      paddingTop: insets.top + TOP_BAR_HEIGHT + spacing.sm,
      paddingBottom: insets.bottom + spacing.sm,
    },
  ];

  const right =
    page === 0 ? (
      sendMode ? null : (
        <IconButton
          icon="pose"
          onPress={() => setSheetVisible(true)}
          accessibilityLabel="Chọn dáng"
          size={48}
          variant={poseActive ? 'accent' : 'surface'}
        />
      )
    ) : (
      <IconButton
        icon="camera"
        onPress={() => goTo(0)}
        accessibilityLabel="Về camera"
        size={48}
      />
    );

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        orientation="vertical"
        initialPage={0}
        scrollEnabled={!sendMode && !sheetVisible}
        offscreenPageLimit={1}
        onPageSelected={e => setPage(e.nativeEvent.position)}
      >
        <View key="camera" style={pageStyle}>
          <CameraPage
            active={isFocused && page === 0}
            size={size}
            friends={friends.friends}
            sheetVisible={sheetVisible}
            onCloseSheet={() => setSheetVisible(false)}
            onPoseChange={onPoseChange}
            onSendModeChange={setSendMode}
            onSent={() => {
              feed.refresh().catch(() => {});
            }}
            onOpenHistory={() => goTo(1)}
            onOpenFriends={() => navigation.navigate('Friends')}
            onScreenFlash={setScreenFlash}
          />
        </View>
        {items.length === 0 ? (
          <View key="empty" style={pageStyle}>
            <EmptyFeedPage
              size={size}
              loading={feed.loading}
              error={feed.error}
              onRetry={() => {
                feed.refresh(true).catch(() => {});
              }}
              onAddFriends={() => navigation.navigate('Friends')}
              onBackToCamera={() => goTo(0)}
            />
          </View>
        ) : (
          items.map((photo, i) => (
            <View key={`photo-${photo.id}`} style={pageStyle}>
              <FeedPage
                photo={photo}
                size={size}
                near={Math.abs(i + 1 - page) <= 2}
                onPhotoChange={onPhotoChange}
                onPhotoDeleted={onPhotoDeleted}
              />
            </View>
          ))
        )}
      </PagerView>

      <View
        style={[styles.topBar, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <TopBar
          user={user}
          friendCount={friends.friends.length}
          requestCount={friends.requests.incoming.length}
          onAvatarPress={() => navigation.navigate('Profile')}
          onFriendsPress={() => navigation.navigate('Friends')}
          right={right}
        />
      </View>
      {screenFlash ? (
        <View style={styles.screenFlash} pointerEvents="none" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pager: { flex: 1 },
  page: { flex: 1 },
  screenFlash: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
});
