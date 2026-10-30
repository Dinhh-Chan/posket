import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PillButton } from '../components/Pill';
import { PoseFigure } from '../components/PoseFigure';
import type { ScreenProps } from '../navigation';
import { getPose } from '../pose/poseLibrary';
import { useSession } from '../state/SessionContext';
import { colors, radii, spacing } from '../theme';

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { serverUrl } = useSession();
  const { width } = useWindowDimensions();
  const heroSize = Math.min(width - spacing.xl * 2, 300);
  const pose = getPose('solo-victory') ?? getPose('solo-confident');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={[styles.heroCard, { width: heroSize, height: heroSize }]}>
          {pose ? (
            <PoseFigure
              pose={pose}
              size={heroSize * 0.86}
              figureOpacity={0.95}
            />
          ) : null}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>92%</Text>
          </View>
        </View>
        <Text style={styles.title}>PoseCam</Text>
        <Text style={styles.tagline}>
          Chụp nhanh, tạo dáng chuẩn{'\n'}và gửi ngay cho bạn thân.
        </Text>
      </View>
      <View style={styles.actions}>
        <PillButton
          label="Tạo tài khoản"
          onPress={() => navigation.navigate('Register')}
        />
        <PillButton
          label="Đăng nhập"
          variant="surface"
          onPress={() => navigation.navigate('Login')}
        />
        <Pressable
          onPress={() => navigation.navigate('Server')}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.serverLink}
        >
          <Text style={styles.serverText} numberOfLines={1}>
            Máy chủ: {serverUrl.replace(/^https?:\/\//, '')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: {
    borderRadius: radii.viewfinder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.accent,
  },
  badge: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    backgroundColor: colors.glass,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  badgeText: { color: colors.success, fontWeight: '800', fontSize: 16 },
  title: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '800',
    marginTop: spacing.xl,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  actions: { gap: spacing.md, paddingBottom: spacing.md },
  serverLink: { alignSelf: 'center', paddingVertical: spacing.sm },
  serverText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
