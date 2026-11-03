import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, Platform, View } from 'react-native';
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
 * 首次启动引导 + 旧数据重置提示 + 通知点按冷启动处理。
 */
function StartupBridge() {
  const router = useRouter();
  const storageResetNotice = useStore((s) => s.storageResetNotice);
  const consumeStorageResetNotice = useStore((s) => s.consumeStorageResetNotice);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // 冷启动时若是由通知按钮点开，先处理数据变更
      await consumeInitialResponse();
      if (cancelled) return;
      // Web 只是开发期预览，不自动弹引导页，避免每次刷新都被跳走
      if (Platform.OS === 'web') return;
      // 读取水合后的最新值，避免持久化恢复晚于首次渲染
      if (!useStore.getState().onboarded) {
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

  // 旧数据被重置时提示一次（持久化水合可能晚于首次挂载）
  useEffect(() => {
    if (Platform.OS === 'web' || !storageResetNotice) return;
    consumeStorageResetNotice();
    Alert.alert(
      '已升级到新版本',
      '服药计划结构已更新，需要重新添加药物并设置服药时间。'
    );
  }, [storageResetNotice, consumeStorageResetNotice]);

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
