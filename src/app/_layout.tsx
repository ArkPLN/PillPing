import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { ThemeProvider } from '@/lib/theme';

import '../../global.css';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <View className="flex-1 bg-bg dark:bg-bg-d">
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </ThemeProvider>
  );
}
