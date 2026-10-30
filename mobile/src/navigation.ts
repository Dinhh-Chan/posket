import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  // Signed out
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
  // Signed in
  Main: undefined;
  Friends: undefined;
  Profile: undefined;
  AvatarCamera: undefined;
  // Both
  Server: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
