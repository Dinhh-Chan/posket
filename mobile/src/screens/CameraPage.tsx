import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Camera,
  type CameraRef,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { errorMessage } from '../api/errors';
import type { User } from '../api/types';
import {
  SNAPSHOT_IS_MIRRORED_LIKE_PREVIEW,
  saveAnalysisFrame,
  saveScaledJpeg,
} from '../camera/snapshot';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Pill } from '../components/Pill';
import { PoseFigure } from '../components/PoseFigure';
import {
  Countdown,
  HintPills,
  ScoreBadge,
  SoftMessage,
} from '../components/PoseHud';
import { PoseSheet, SUGGEST_TAB } from '../components/PoseSheet';
import { RecipientRow } from '../components/RecipientRow';
import { Shutter } from '../components/Shutter';
import {
  ANALYZE_JPEG_QUALITY,
  ANALYZE_MAX_SIDE,
  CAPTION_MAX,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_SIDE,
} from '../config';
import { useAutoCapture } from '../hooks/useAutoCapture';
import {
  type AnalysisSnapshot,
  useLiveAnalysis,
} from '../hooks/useLiveAnalysis';
import { setMaxBrightness } from '../native';
import { displayScore, statusMessage, visibleHints } from '../pose/feedback';
import { fallbackCategory } from '../pose/poseLibrary';
import type { Pose } from '../pose/types';
import { useSession } from '../state/SessionContext';
import { loadAutoCapture, saveAutoCapture } from '../state/storage';
import { colors, radii, spacing } from '../theme';
import { newClientId } from '../utils/clientId';

type Position = 'front' | 'back';

interface Captured {
  uri: string;
  mirror: boolean;
  poseId: string | null;
  /** Upload key; reused if the upload is retried. */
  clientId: string;
}

export interface CameraPageProps {
  /** Camera page visible and the Main screen focused. */
  active: boolean;
  /** Viewfinder side in px. */
  size: number;
  friends: User[];
  sheetVisible: boolean;
  onCloseSheet: () => void;
  onPoseChange: (pose: Pose | null) => void;
  onSendModeChange: (sendMode: boolean) => void;
  onSent: () => void;
  onOpenHistory: () => void;
  onOpenFriends: () => void;
  /** Front-camera flash: the parent shows a full-screen white layer. */
  onScreenFlash: (on: boolean) => void;
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function CameraPage({
  active,
  size,
  friends,
  sheetVisible,
  onCloseSheet,
  onPoseChange,
  onSendModeChange,
  onSent,
  onOpenHistory,
  onOpenFriends,
  onScreenFlash,
}: CameraPageProps) {
  const { api } = useSession();
  const permission = useCameraPermission();
  const [position, setPosition] = useState<Position>('front');
  const device = useCameraDevice(position);
  const cameraRef = useRef<CameraRef>(null);
  // takeSnapshot() is Android-only; iOS falls back to a photo output.
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'speed' });
  const [previewReady, setPreviewReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [torch, setTorch] = useState<'on' | 'off'>('off');
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [caption, setCaption] = useState('');
  const [recipients, setRecipients] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Pose guide
  const [pose, setPose] = useState<Pose | null>(null);
  const [sheetTab, setSheetTab] = useState<string>(SUGGEST_TAB);
  const [tip, setTip] = useState<string | null>(null);
  const [autoCapture, setAutoCapture] = useState(false);

  const sendMode = captured !== null;
  const { canRequestPermission, requestPermission, hasPermission } = permission;

  useEffect(() => {
    loadAutoCapture()
      .then(setAutoCapture)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission().catch(() => {});
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  useEffect(() => {
    onSendModeChange(sendMode);
  }, [sendMode, onSendModeChange]);

  useEffect(() => {
    if (!tip) {
      return;
    }
    const id = setTimeout(() => setTip(null), 4000);
    return () => clearTimeout(id);
  }, [tip]);

  const cameraActive =
    active && !sendMode && hasPermission && device !== undefined;
  useEffect(() => {
    if (!cameraActive) {
      setPreviewReady(false);
    }
  }, [cameraActive]);

  /** Grabs the current viewfinder as a nitro Image (Android: preview snapshot). */
  const grabFrame = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera) {
      throw new Error('camera not ready');
    }
    if (Platform.OS === 'android') {
      // PreviewView bitmap: what is displayed, already mirrored for the front camera.
      return {
        image: await camera.takeSnapshot(),
        mirror: !SNAPSHOT_IS_MIRRORED_LIKE_PREVIEW && position === 'front',
      };
    }
    const photo = await photoOutput.capturePhoto(
      { flashMode: 'off', enableShutterSound: false },
      {},
    );
    try {
      const image = await photo.toImageAsync();
      return { image, mirror: position === 'front' && !photo.isMirrored };
    } finally {
      photo.dispose();
    }
  }, [photoOutput, position]);

  const takeAnalysisSnapshot =
    useCallback(async (): Promise<AnalysisSnapshot | null> => {
      if (!cameraRef.current) {
        return null;
      }
      const { image, mirror } = await grabFrame();
      try {
        const uri = await saveAnalysisFrame(
          image,
          ANALYZE_MAX_SIDE,
          ANALYZE_JPEG_QUALITY,
        );
        return { uri, mirror };
      } finally {
        image.dispose();
      }
    }, [grabFrame]);

  const analysisEnabled =
    cameraActive &&
    previewReady &&
    (pose !== null || (sheetVisible && sheetTab === SUGGEST_TAB));
  const live = useLiveAnalysis({
    enabled: analysisEnabled,
    poseId: pose?.id ?? null,
    api,
    takeSnapshot: takeAnalysisSnapshot,
  });
  const match =
    pose && live.result?.match?.pose_id === pose.id ? live.result.match : null;

  const capture = useCallback(async () => {
    if (capturing || !cameraRef.current || !previewReady) {
      return;
    }
    setCapturing(true);
    const useScreenFlash = flash && position === 'front';
    const useTorch = flash && position === 'back' && device?.hasTorch === true;
    try {
      if (useScreenFlash) {
        onScreenFlash(true);
        setMaxBrightness(true);
        await delay(350);
      } else if (useTorch) {
        setTorch('on');
        await delay(450);
      }
      const { image, mirror } = await grabFrame();
      let saved;
      try {
        saved = await saveScaledJpeg(image, PHOTO_MAX_SIDE, PHOTO_JPEG_QUALITY);
      } finally {
        image.dispose();
      }
      setCaption('');
      setRecipients([]);
      setCaptured({
        uri: saved.uri,
        mirror,
        poseId: pose?.id ?? null,
        clientId: newClientId(),
      });
    } catch {
      Alert.alert('Không chụp được ảnh', 'Camera chưa sẵn sàng, thử lại nhé.');
    } finally {
      if (useScreenFlash) {
        setMaxBrightness(false);
        onScreenFlash(false);
      }
      if (useTorch) {
        setTorch('off');
      }
      setCapturing(false);
    }
  }, [
    capturing,
    previewReady,
    flash,
    position,
    device,
    grabFrame,
    pose,
    onScreenFlash,
  ]);

  const countdown = useAutoCapture({
    enabled: autoCapture && pose !== null && analysisEnabled,
    result: live.result,
    onCapture: () => {
      capture().catch(() => {});
    },
  });

  // Hardware back in send mode discards the photo instead of leaving the app.
  useEffect(() => {
    if (!sendMode || !active) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Keyboard.dismiss();
      setCaptured(null);
      setSent(false);
      return true;
    });
    return () => sub.remove();
  }, [sendMode, active]);

  const discard = () => {
    Keyboard.dismiss();
    setCaptured(null);
    setSent(false);
  };

  const send = async () => {
    if (!captured || sending) {
      return;
    }
    Keyboard.dismiss();
    setSending(true);
    try {
      await api.sendPhoto({
        file: { uri: captured.uri, name: 'photo.jpg', type: 'image/jpeg' },
        caption,
        recipientIds: recipients,
        mirror: captured.mirror,
        poseId: captured.poseId,
        clientId: captured.clientId,
      });
      setSent(true);
      onSent();
      setTimeout(() => {
        setSent(false);
        setCaptured(null);
      }, 1100);
    } catch (e) {
      Alert.alert('Chưa gửi được ảnh', errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const selectPose = (next: Pose) => {
    setPose(next);
    onPoseChange(next);
    setTip(next.tip || null);
    onCloseSheet();
  };

  const clearPose = () => {
    setPose(null);
    onPoseChange(null);
    setTip(null);
  };

  const toggleAuto = () => {
    const next = !autoCapture;
    setAutoCapture(next);
    saveAutoCapture(next).catch(() => {});
  };

  const flip = () => {
    setPreviewReady(false);
    setPosition(p => (p === 'front' ? 'back' : 'front'));
  };

  const score = displayScore(match);
  const soft = statusMessage(match, pose ?? undefined);
  const hints = visibleHints(match);
  const offline = pose !== null && live.reachable === false;

  return (
    <View style={styles.page}>
      <View style={[styles.viewfinder, { width: size, height: size }]}>
        {captured ? (
          <Image
            source={{ uri: captured.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : !hasPermission ? (
          <PermissionPrompt
            canRequest={canRequestPermission}
            onRequest={() => {
              if (canRequestPermission) {
                requestPermission().catch(() => {});
              } else {
                Linking.openSettings().catch(() => {});
              }
            }}
          />
        ) : device ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={cameraActive}
            outputs={Platform.OS === 'ios' ? [photoOutput] : []}
            torchMode={torch}
            resizeMode="cover"
            implementationMode="compatible"
            enableNativeZoomGesture
            enableNativeTapToFocusGesture
            onPreviewStarted={() => {
              setCameraError(null);
              setPreviewReady(true);
            }}
            onPreviewStopped={() => setPreviewReady(false)}
            onError={() => setCameraError('Không mở được camera')}
          />
        ) : null}

        {!captured && pose ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <PoseFigure
              pose={pose}
              size={size}
              match={match}
              figureOpacity={0.85}
              outline
            />
          </View>
        ) : null}

        {!captured && hasPermission && !previewReady ? (
          <View style={styles.loading} pointerEvents="none">
            {cameraError ? (
              <Text style={styles.loadingText}>{cameraError}</Text>
            ) : (
              <ActivityIndicator color={colors.textSecondary} />
            )}
          </View>
        ) : null}

        {!captured && pose ? (
          <View style={styles.hud} pointerEvents="box-none">
            <View style={styles.hudTop} pointerEvents="box-none">
              <View style={styles.hudSide} pointerEvents="box-none">
                <Pill
                  small
                  variant="glass"
                  label={pose.name}
                  onPress={clearPose}
                  accessibilityLabel={`Bỏ dáng ${pose.name}`}
                  right={<Icon name="close" size={14} />}
                />
              </View>
              {score !== null ? (
                <View pointerEvents="none">
                  <ScoreBadge score={score} ready={match?.ready === true} />
                </View>
              ) : null}
              <View
                style={[styles.hudSide, styles.hudSideRight]}
                pointerEvents="box-none"
              >
                <Pill
                  small
                  variant={autoCapture ? 'accent' : 'glass'}
                  label="Tự chụp"
                  left={
                    <Icon
                      name="bolt"
                      size={14}
                      filled
                      color={autoCapture ? '#000' : colors.accent}
                    />
                  }
                  onPress={toggleAuto}
                  accessibilityLabel={
                    autoCapture ? 'Tắt tự chụp' : 'Bật tự chụp'
                  }
                />
              </View>
            </View>
            <View style={styles.hudBottom} pointerEvents="none">
              {tip ? (
                <SoftMessage text={`💡 ${tip}`} />
              ) : offline ? (
                <SoftMessage text="Không kết nối được máy chủ chấm điểm" />
              ) : soft ? (
                <SoftMessage text={soft} />
              ) : hints.length > 0 ? (
                <HintPills hints={hints} />
              ) : null}
            </View>
          </View>
        ) : null}

        {countdown !== null && !captured ? (
          <Countdown value={countdown} />
        ) : null}

        {captured ? (
          <View style={styles.captionWrap} pointerEvents="box-none">
            <TextInput
              value={caption}
              onChangeText={t => setCaption(t.slice(0, CAPTION_MAX))}
              maxLength={CAPTION_MAX}
              placeholder="Thêm lời nhắn…"
              placeholderTextColor="rgba(255,255,255,0.75)"
              style={[
                styles.captionInput,
                caption.length === 0 && styles.captionEmpty,
              ]}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              returnKeyType="done"
              blurOnSubmit
              textAlign="center"
            />
          </View>
        ) : null}

        {captured && sent ? (
          <View style={styles.sentOverlay}>
            <View style={styles.sentBadge}>
              <Icon name="check" size={36} color="#000" strokeWidth={3} />
            </View>
            <Text style={styles.sentText}>Đã gửi!</Text>
          </View>
        ) : null}
      </View>

      {/* Same three slots in both modes so the shutter never moves. */}
      <View style={styles.bottom}>
        <View style={styles.slotTop}>
          {captured ? (
            <>
              <Text style={styles.sendTo}>Gửi đến</Text>
              <RecipientRow
                friends={friends}
                selected={recipients}
                onChange={setRecipients}
                onAddFriends={onOpenFriends}
              />
            </>
          ) : null}
        </View>
        {captured ? (
          <View style={styles.controls}>
            <IconButton
              icon="close"
              onPress={discard}
              accessibilityLabel="Bỏ ảnh"
              size={56}
            />
            <Shutter
              mode="send"
              onPress={send}
              busy={sending}
              disabled={sent}
            />
            <View style={styles.controlSpacer} />
          </View>
        ) : (
          <View style={styles.controls}>
            <IconButton
              icon="bolt"
              onPress={() => setFlash(f => !f)}
              accessibilityLabel={flash ? 'Tắt đèn flash' : 'Bật đèn flash'}
              size={56}
              filled={flash}
              color={flash ? colors.accent : colors.text}
            />
            <Shutter
              onPress={capture}
              busy={capturing}
              disabled={!previewReady}
            />
            <IconButton
              icon="flip"
              onPress={flip}
              accessibilityLabel="Đổi camera"
              size={56}
            />
          </View>
        )}
        <View style={styles.slotBottom}>
          {captured ? null : (
            <Pressable
              onPress={onOpenHistory}
              style={styles.historyHint}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.historyText}>Lịch sử</Text>
              <Icon name="chevronDown" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <PoseSheet
        visible={sheetVisible}
        onClose={onCloseSheet}
        selectedPoseId={pose?.id ?? null}
        onSelect={selectPose}
        tab={sheetTab}
        onTabChange={setSheetTab}
        suggestions={live.result?.suggestions ?? []}
        reachable={live.reachable}
        fallbackCategoryId={fallbackCategory(position)}
      />
    </View>
  );
}

function PermissionPrompt({
  canRequest,
  onRequest,
}: {
  canRequest: boolean;
  onRequest: () => void;
}) {
  return (
    <View style={styles.permission}>
      <Text style={styles.permissionTitle}>Cho phép dùng camera</Text>
      <Text style={styles.permissionText}>
        PoseCam cần camera để chụp ảnh và hướng dẫn tạo dáng.
      </Text>
      <Pill
        label={canRequest ? 'Cho phép' : 'Mở Cài đặt'}
        variant="accent"
        onPress={onRequest}
        style={styles.permissionButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center' },
  viewfinder: {
    borderRadius: radii.viewfinder,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: colors.textSecondary, fontWeight: '700' },
  hud: { ...StyleSheet.absoluteFill, padding: spacing.lg },
  hudTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hudSide: { flex: 1, alignItems: 'flex-start' },
  hudSideRight: { alignItems: 'flex-end' },
  hudBottom: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    alignItems: 'center',
  },
  captionWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    alignItems: 'center',
  },
  captionInput: {
    maxWidth: '100%',
    minWidth: 180,
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  captionEmpty: { backgroundColor: 'rgba(0,0,0,0.35)' },
  sentOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  sentBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentText: { color: colors.text, fontSize: 22, fontWeight: '800' },
  bottom: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },
  slotTop: { minHeight: 112, gap: spacing.sm },
  slotBottom: { height: 52, justifyContent: 'flex-end' },
  sendTo: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl + spacing.sm,
  },
  controlSpacer: { width: 56 },
  historyHint: { alignSelf: 'center', alignItems: 'center' },
  historyText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  permission: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionButton: { marginTop: spacing.md },
});
