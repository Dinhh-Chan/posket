import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createApiClient, normalizeBaseUrl } from '../api/client';
import { errorMessage } from '../api/errors';
import { DEFAULT_SERVER_URL } from '../config';
import { useSession } from '../state/SessionContext';
import { colors, spacing } from '../theme';
import { Pill } from './Pill';
import { TextField } from './TextField';

type Status = { kind: 'ok' | 'error' | 'info'; text: string } | null;

/** Edit, test and save the backend URL (persisted; the API client reads it on every call). */
export function ServerUrlForm({
  onSaved,
  raised,
}: {
  onSaved?: () => void;
  /** Inputs on a surface card. */
  raised?: boolean;
}) {
  const { serverUrl, setServerUrl } = useSession();
  const [value, setValue] = useState(serverUrl);
  const [status, setStatus] = useState<Status>(null);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    const url = normalizeBaseUrl(value) || DEFAULT_SERVER_URL;
    setTesting(true);
    setStatus({ kind: 'info', text: 'Đang kiểm tra…' });
    try {
      const probe = createApiClient({
        getBaseUrl: () => url,
        getToken: () => null,
        timeoutMs: 5000,
      });
      const health = await probe.health();
      setStatus({
        kind: 'ok',
        text:
          health.detector === 'mediapipe'
            ? 'Đã kết nối · nhận diện dáng sẵn sàng'
            : 'Đã kết nối · máy chủ chưa bật nhận diện dáng',
      });
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const url = normalizeBaseUrl(value) || DEFAULT_SERVER_URL;
    setValue(url);
    await setServerUrl(url);
    setStatus({ kind: 'ok', text: 'Đã lưu địa chỉ máy chủ' });
    onSaved?.();
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label="Địa chỉ máy chủ"
        raised={raised}
        value={value}
        onChangeText={setValue}
        placeholder={DEFAULT_SERVER_URL}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        onSubmitEditing={save}
        hint="Máy ảo Android: http://10.0.2.2:8020 · Điện thoại: http://<IP máy tính>:8020"
      />
      <View style={styles.row}>
        <Pill
          label={testing ? 'Đang kiểm tra…' : 'Kiểm tra'}
          onPress={test}
          disabled={testing}
        />
        <Pill label="Lưu" variant="accent" onPress={save} />
        <Pill
          label="Mặc định"
          variant="outline"
          onPress={() => setValue(DEFAULT_SERVER_URL)}
        />
      </View>
      {status ? (
        <Text
          style={[
            styles.status,
            status.kind === 'ok' && styles.ok,
            status.kind === 'error' && styles.error,
          ]}
        >
          {status.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  status: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  ok: { color: colors.success },
  error: { color: colors.error },
});
