import React, { useRef, useState } from 'react';
import { Text, type TextInputInstance } from 'react-native';
import { errorMessage } from '../api/errors';
import { FormScreen } from '../components/FormScreen';
import { PillButton } from '../components/Pill';
import { TextField } from '../components/TextField';
import type { ScreenProps } from '../navigation';
import { useSession } from '../state/SessionContext';
import { formStyles } from './formStyles';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { login } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Nhập tên người dùng và mật khẩu');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <FormScreen
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại!"
      onBack={() => navigation.goBack()}
      footer={
        <PillButton label="Đăng nhập" onPress={submit} loading={loading} />
      }
    >
      <TextField
        label="Tên người dùng"
        placeholder="Tên người dùng"
        value={username}
        onChangeText={t => setUsername(t.toLowerCase().replace(/\s/g, ''))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Mật khẩu"
        placeholder="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
    </FormScreen>
  );
}
