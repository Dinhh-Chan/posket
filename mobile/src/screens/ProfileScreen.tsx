import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { version as appVersion } from '../../package.json';
import { errorMessage } from '../api/errors';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { Pill, PillButton } from '../components/Pill';
import { ScreenHeader } from '../components/ScreenHeader';
import { ServerUrlForm } from '../components/ServerUrlForm';
import { TextField } from '../components/TextField';
import { widget } from '../native';
import type { ScreenProps } from '../navigation';
import { useSession } from '../state/SessionContext';
import { colors, radii, spacing } from '../theme';
import { displayNameError } from '../utils/validation';

export function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const { api, user, setUser, logout } = useSession();
  const [name, setName] = useState(user?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const nameChanged = name.trim() !== (user?.display_name ?? '');

  const saveName = async () => {
    const err = displayNameError(name);
    if (err) {
      setNameMessage({ ok: false, text: err });
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMe({ display_name: name.trim() });
      setUser(updated);
      setNameMessage({ ok: true, text: 'Đã lưu tên hiển thị' });
    } catch (e) {
      setNameMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để xem ảnh.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const addWidget = async () => {
    const ok = await widget.requestPin();
    if (!ok) {
      Alert.alert(
        'Thêm widget',
        'Giữ ngón tay trên màn hình chính → Widget → PoseCam để thêm widget ảnh bạn bè.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Hồ sơ" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Pressable
            onPress={() => navigation.navigate('AvatarCamera')}
            accessibilityRole="button"
            accessibilityLabel="Đổi ảnh đại diện"
          >
            <Avatar user={user} size={112} ring />
            <View style={styles.cameraBadge}>
              <Icon name="camera" size={18} color="#000" />
            </View>
          </Pressable>
          <Text style={styles.displayName}>{user?.display_name}</Text>
          <Text style={styles.username}>@{user?.username}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tên hiển thị</Text>
          <TextField
            raised
            value={name}
            onChangeText={t => {
              setName(t);
              setNameMessage(null);
            }}
            maxLength={40}
            placeholder="Tên hiển thị"
            returnKeyType="done"
            onSubmitEditing={saveName}
          />
          <View style={styles.row}>
            <Pill
              label={saving ? 'Đang lưu…' : 'Lưu tên'}
              variant="accent"
              onPress={saveName}
              disabled={saving || !nameChanged}
            />
            {nameMessage ? (
              <Text
                style={[
                  styles.message,
                  nameMessage.ok ? styles.ok : styles.err,
                ]}
              >
                {nameMessage.text}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Máy chủ</Text>
          <ServerUrlForm raised />
        </View>

        {Platform.OS === 'android' && widget.available ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Widget màn hình chính</Text>
            <Text style={styles.cardText}>
              Ảnh mới nhất bạn bè gửi sẽ hiện ngay trên màn hình chính.
            </Text>
            <Pill
              label="Thêm widget"
              onPress={addWidget}
              style={styles.alignStart}
            />
          </View>
        ) : null}

        <PillButton
          label="Đăng xuất"
          variant="danger"
          onPress={confirmLogout}
        />
        <Text style={styles.version}>PoseCam phiên bản {appVersion}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  displayName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  username: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  cardText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  message: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  ok: { color: colors.success },
  err: { color: colors.error },
  alignStart: { alignSelf: 'flex-start' },
  version: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
