import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { TabBarButton } from '@/components/ui/TabBarButton';
import { useTheme } from '@/lib/theme';

/**
 * 底部三 Tab：今日 / 药物 / 特殊。
 * 对应 legacy MainActivity.buildShell() 的手写导航栏，
 * 这里用 expo-router 的 Tabs（底层是 React Navigation bottom-tabs）。
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color('primary'),
        tabBarInactiveTintColor: color('muted'),
        tabBarStyle: {
          backgroundColor: color('card'),
          borderTopColor: color('line'),
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 7,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '500',
        },
        tabBarButton: TabBarButton,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarIcon: ({ color: c }) => <Icon name="today" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: '药物',
          tabBarIcon: ({ color: c }) => <Icon name="pill" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="special"
        options={{
          title: '特殊',
          tabBarIcon: ({ color: c }) => <Icon name="clock" size={22} color={c} />,
        }}
      />
    </Tabs>
  );
}
