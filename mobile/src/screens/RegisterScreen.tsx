import React, { useRef, useState } from 'react';
import { Text, type TextInputInstance } from 'react-native';
import { errorMessage } from '../api/errors';
import { FormScreen } from '../components/FormScreen';
import { PillButton } from '../components/Pill';
import { TextField } from '../components/TextField';
import type { ScreenProps } from '../navigation';
import { useSession } from '../state/SessionContext';
import { formStyles } from './formStyles';
import {
  displayNameError,
  passwordError,
  usernameError,
} from '../utils/validation';

export function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { register } = useSession();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const errors = {
    username: usernameError(username),
    displayName: displayNameError(displayName),
    password: passwordError(password),
  };

  const submit = async () => {
    setTouched(true);
    if (errors.username || errors.displayName || errors.password) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(username, displayName, password);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <FormScreen
      title="Tạo tài khoản"
      subtitle="Bạn bè sẽ tìm bạn bằng tên người dùng."
      onBack={() => navigation.goBack()}
      footer={
        <PillButton label="Tạo tài khoản" onPress={submit} loading={loading} />
      }
    >
      <TextField
        label="Tên người dùng"
        placeholder="vd: linh.nguyen"
        value={username}
        onChangeText={t => setUsername(t.toLowerCase().replace(/\s/g, ''))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        maxLength={20}
        returnKeyType="next"
        onSubmitEditing={() => nameRef.current?.focus()}
        error={touched ? errors.username : null}
        hint="3–20 ký tự: a–z, 0–9, _ và ."
      />
      <TextField
        ref={nameRef}
        label="Tên hiển thị"
        placeholder="vd: Linh"
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
        maxLength={40}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={touched ? errors.displayName : null}
      />
      <TextField
        ref={passwordRef}
        label="Mật khẩu"
        placeholder="Ít nhất 6 ký tự"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={submit}
        error={touched ? errors.password : null}
      />
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
    </FormScreen>
  );
}
