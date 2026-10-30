import {
  DarkTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './navigation';
import { AvatarCameraScreen } from './screens/AvatarCameraScreen';
import { FriendsScreen } from './screens/FriendsScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MainScreen } from './screens/MainScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ServerScreen } from './screens/ServerScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SessionProvider, useSession } from './state/SessionContext';
import { colors } from './theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: colors.accent,
    text: colors.text,
    border: colors.surface,
  },
};

function Splash() {
  return (
    <View style={styles.splash}>
      <Text style={styles.logo}>PoseCam</Text>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function RootNavigator() {
  const { status } = useSession();
  if (status === 'loading') {
    return <Splash />;
  }
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      {status === 'signedIn' ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen name="Friends" component={FriendsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen
            name="AvatarCamera"
            component={AvatarCameraScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Server" component={ServerScreen} />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Server" component={ServerScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SessionProvider>
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  logo: { color: colors.text, fontSize: 40, fontWeight: '800' },
});
