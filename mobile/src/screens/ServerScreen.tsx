import React from 'react';
import { FormScreen } from '../components/FormScreen';
import { ServerUrlForm } from '../components/ServerUrlForm';
import type { ScreenProps } from '../navigation';

export function ServerScreen({ navigation }: ScreenProps<'Server'>) {
  return (
    <FormScreen
      title="Máy chủ"
      subtitle="Địa chỉ backend PoseCam mà app kết nối tới."
      onBack={() => navigation.goBack()}
    >
      <ServerUrlForm />
    </FormScreen>
  );
}
