import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Suggestion } from '../api/types';
import {
  easiestPoses,
  getCategory,
  getPose,
  library,
  posesInCategory,
} from '../pose/poseLibrary';
import type { Pose } from '../pose/types';
import { colors, radii, spacing } from '../theme';
import { IconButton } from './IconButton';
import { PoseCard } from './PoseCard';

export const SUGGEST_TAB = 'suggest';

interface SheetItem {
  pose: Pose;
  subtitle?: string;
}

export type SuggestMode = 'server' | 'offline' | 'waiting' | 'empty';

/**
 * Items for the Gợi ý tab: the backend suggestions with their reasons, or —
 * while waiting, when the backend has none or cannot be reached — the easiest
 * library poses of a sensible category.
 */
export function suggestionItems(
  suggestions: Suggestion[],
  reachable: boolean | null,
  fallbackCategoryId: string,
): { items: SheetItem[]; mode: SuggestMode } {
  const fromServer: SheetItem[] = [];
  for (const s of suggestions) {
    const pose = getPose(s.pose_id);
    if (pose) {
      fromServer.push({ pose, subtitle: s.reason });
    }
  }
  if (fromServer.length > 0) {
    return { items: fromServer, mode: 'server' };
  }
  const label = getCategory(fallbackCategoryId)?.label ?? '';
  const items = easiestPoses(fallbackCategoryId, 9).map(pose => ({
    pose,
    subtitle: label ? `Dễ · ${label}` : 'Dễ làm theo',
  }));
  const mode: SuggestMode =
    reachable === false ? 'offline' : reachable === null ? 'waiting' : 'empty';
  return { items, mode };
}

export interface PoseSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedPoseId: string | null;
  onSelect: (pose: Pose) => void;
  tab: string;
  onTabChange: (tab: string) => void;
  suggestions: Suggestion[];
  /** null = no answer yet, false = backend unreachable. */
  reachable: boolean | null;
  fallbackCategoryId: string;
}

const COLUMNS = 3;

export function PoseSheet({
  visible,
  onClose,
  selectedPoseId,
  onSelect,
  tab,
  onTabChange,
  suggestions,
  reachable,
  fallbackCategoryId,
}: PoseSheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const tabsRef = useRef<ScrollViewInstance>(null);
  const tabX = useRef<Record<string, number>>({});

  // Keep the active category chip visible.
  useEffect(() => {
    const x = tabX.current[tab];
    if (x !== undefined) {
      tabsRef.current?.scrollTo({
        x: Math.max(0, x - spacing.xl),
        animated: true,
      });
    }
  }, [tab]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
  }, [visible, progress]);

  const sheetHeight = Math.round(height * 0.68);
  const cardWidth = Math.floor(
    (width - spacing.lg * 2 - spacing.md * (COLUMNS - 1)) / COLUMNS,
  );

  const { items, mode } = useMemo((): {
    items: SheetItem[];
    mode: SuggestMode;
  } => {
    if (tab === SUGGEST_TAB) {
      return suggestionItems(suggestions, reachable, fallbackCategoryId);
    }
    return {
      items: posesInCategory(tab).map(pose => ({ pose })),
      mode: 'server',
    };
  }, [tab, suggestions, reachable, fallbackCategoryId]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight, 0],
  });

  const tabs = [
    { id: SUGGEST_TAB, label: '✨ Gợi ý' },
    ...library.categories.map(c => ({
      id: c.id,
      label: `${c.emoji} ${c.label}`,
    })),
  ];

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Đóng"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight + insets.bottom,
            paddingBottom: insets.bottom,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>Chọn dáng</Text>
          <IconButton
            icon="close"
            onPress={onClose}
            accessibilityLabel="Đóng"
            size={36}
          />
        </View>
        <ScrollView
          ref={tabsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          style={styles.tabsScroll}
        >
          {tabs.map(t => {
            const active = t.id === tab;
            return (
              <Pressable
                key={t.id}
                onPress={() => onTabChange(t.id)}
                onLayout={e => {
                  tabX.current[t.id] = e.nativeEvent.layout.x;
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {tab === SUGGEST_TAB ? <SuggestHeader mode={mode} /> : null}
        <FlatList
          data={items}
          key={`grid-${COLUMNS}`}
          numColumns={COLUMNS}
          keyExtractor={item => item.pose.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <PoseCard
              pose={item.pose}
              width={cardWidth}
              subtitle={item.subtitle}
              selected={item.pose.id === selectedPoseId}
              onPress={onSelect}
            />
          )}
        />
      </Animated.View>
    </Modal>
  );
}

function SuggestHeader({ mode }: { mode: SuggestMode }) {
  if (mode === 'waiting') {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={[styles.note, styles.noteInline]}>
          Đang xem khung hình để gợi ý…
        </Text>
      </View>
    );
  }
  const text =
    mode === 'offline'
      ? 'Không kết nối được máy chủ — đây là các dáng dễ làm theo.'
      : mode === 'empty'
      ? 'Chưa có gợi ý cho khung hình này — thử các dáng dễ sau.'
      : 'Gợi ý theo những gì camera đang thấy';
  return <Text style={styles.note}>{text}</Text>;
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceHigh,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  tabTextActive: { color: '#000' },
  grid: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  row: { gap: spacing.md },
  note: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  noteInline: { paddingHorizontal: spacing.sm, paddingBottom: 0 },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
