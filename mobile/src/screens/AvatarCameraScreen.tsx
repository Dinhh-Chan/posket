import { useIsFocused } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  type CameraRef,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { errorMessage } from '../api/errors';
import { saveScaledJpeg } from '../camera/snapshot';
import { IconButton } from '../components/IconButton';
import { Pill, PillButton } from '../components/Pill';
import { ScreenHeader } from '../components/ScreenHeader';
import { Shutter } from '../components/Shutter';
import type { ScreenProps } from '../navigation';
import { useSession } from '../state/SessionContext';
import { colors, spacing } from '../theme';

/** Take a new avatar with the camera (round crop preview), upload to POST /me/avatar. */
export function AvatarCameraScreen({
  navigation,
}: ScreenProps<'AvatarCamera'>) {
  const { api, setUser } = useSession();
  const focused = useIsFocused();
  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();
  const [position, setPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(position);
  const cameraRef = useRef<CameraRef>(null);
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'speed' });
  const [ready, setReady] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const size = Math.min(width - spacing.xl * 2, 320);

  const capture = async () => {
    if (!cameraRef.current || busy) {
      return;
    }
    setBusy(true);
    try {
      let image;
      if (Platform.OS === 'android') {
        image = await cameraRef.current.takeSnapshot();
      } else {
        const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
        image = await photo.toImageAsync();
        photo.dispose();
      }
      const saved = await saveScaledJpeg(image, 800, 90);
      image.dispose();
      setUri(saved.uri);
    } catch {
      Alert.alert('Không chụp được ảnh', 'Thử lại nhé.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!uri) {
      return;
    }
    setBusy(true);
    try {
      const user = await api.uploadAvatar({
        uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      });
      setUser(user);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Không cập nhật được ảnh đại diện', errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Ảnh đại diện" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View
          style={[
            styles.circle,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} />
          ) : hasPermission && device ? (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={focused && !uri}
              outputs={Platform.OS === 'ios' ? [photoOutput] : []}
              implementationMode="compatible"
              onPreviewStarted={() => setReady(true)}
              onPreviewStopped={() => setReady(false)}
            />
          ) : !hasPermission ? (
            <View style={styles.center}>
              <Text style={styles.text}>Cần quyền camera</Text>
              <Pill
                label="Cho phép"
                variant="accent"
                onPress={() => {
                  if (canRequestPermission) {
                    requestPermission().catch(() => {});
                  }
                }}
              />
            </View>
          ) : (
            <ActivityIndicator
              color={colors.textSecondary}
              style={styles.center}
            />
          )}
        </View>
        <Text style={styles.text}>
          {uri
            ? 'Dùng ảnh này làm ảnh đại diện?'
            : 'Căn khuôn mặt vào giữa vòng tròn'}
        </Text>
      </View>
      <View style={styles.footer}>
        {uri ? (
          <>
            <PillButton label="Dùng ảnh này" onPress={upload} loading={busy} />
            <PillButton
              label="Chụp lại"
              variant="surface"
              onPress={() => setUri(null)}
              disabled={busy}
            />
          </>
        ) : (
          <View style={styles.controls}>
            <View style={styles.spacer} />
            <Shutter onPress={capture} busy={busy} disabled={!ready} />
            <IconButton
              icon="flip"
              onPress={() => {
                setReady(false);
                setPosition(p => (p === 'front' ? 'back' : 'front'));
              }}
              accessibilityLabel="Đổi camera"
              size={56}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  circle: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.accent,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: { padding: spacing.xl, gap: spacing.md },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  spacer: { width: 56 },
});
