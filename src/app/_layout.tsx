import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useNotificationLifecycle } from '@/lib/notifications/useNotificationLifecycle';
import { ThemeProvider } from '@/lib/theme';

import '../../global.css';

function NotificationBridge() {
  useNotificationLifecycle();
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NotificationBridge />
        <View className="flex-1 bg-bg dark:bg-bg-d">
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
