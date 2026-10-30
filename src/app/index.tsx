import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-bg px-6 dark:bg-bg-d">
      <Text className="text-2xl font-bold text-ink dark:text-ink-d">按时吃药</Text>
      <Text className="mt-3 text-center text-sm text-muted dark:text-muted-d">
        正在迁移中：Expo + React Native 版本
      </Text>
    </View>
  );
}
