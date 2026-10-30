import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  consumeInitialResponse,
  useNotificationLifecycle,
} from '@/lib/notifications/useNotificationLifecycle';
import { ThemeProvider } from '@/lib/theme';
import { useStore } from '@/store/useStore';

import '../../global.css';

function NotificationBridge() {
  useNotificationLifecycle();
  return null;
}

/**
 * 首次启动引导 + 通知点按冷启动处理。
 * 对应 legacy MainActivity 里
 * `if (!store.isOnboarded()) handler.postDelayed(this::showOnboarding, 300)`。
 */
function StartupBridge() {
  const router = useRouter();
  const onboarded = useStore((s) => s.onboarded);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // 冷启动时若是由通知按钮点开，先处理数据变更
      await consumeInitialResponse();
      if (cancelled) return;
      if (!onboarded) {
        // 稍微延迟，等 Tabs 挂载完成
        setTimeout(() => {
          if (!cancelled) router.push('/guide');
        }, 300);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // 只在首次挂载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NotificationBridge />
        <StartupBridge />
        <View className="flex-1 bg-bg dark:bg-bg-d">
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
