import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Bold, TextMuted } from '@/components/ui/Text';
import { formatMonthDay, weekday } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/**
 * 今日页 / 药物页 / 特殊页的通用头部。
 *
 * 今日页对应 legacy buildHeader()：
 * - 连续使用 ≥3 天显示问候语（早上好/中午好/…）并带挥手图标
 * - 连续 ≥7 天副标题显示「已坚持 N 天」
 * - 提醒暂停时显示「提醒已暂停」胶囊
 */

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 11) return '早上好';
  if (hour >= 11 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  if (hour >= 18 && hour < 23) return '晚上好';
  return '夜深了';
}

/** 圆形图标按钮（设置 / 添加）。对应 legacy 手写的 FrameLayout + ripple。 */
export function HeaderIconButton({
  onPress,
  children,
  accessibilityLabel,
  tone = 'primary',
}: {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  tone?: 'primary' | 'violet';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`h-[42px] w-[42px] items-center justify-center rounded-full active:opacity-70 ${
        tone === 'violet' ? 'bg-violet dark:bg-violet-d' : 'bg-mint dark:bg-mint-d'
      }`}
    >
      {children}
    </Pressable>
  );
}

export function HomeHeader({
  useStreak,
  remindersEnabled,
  onSettings,
}: {
  useStreak: number;
  remindersEnabled: boolean;
  onSettings: () => void;
}) {
  const { color } = useTheme();
  const hour = new Date().getHours();
  const showGreeting = useStreak >= 3;
  const title = showGreeting ? greeting(hour) : '服药提醒';

  const date = `${formatMonthDay(Date.now())}  ${weekday(Date.now())}`;
  let subText = `${date} · 今天`;
  if (useStreak >= 7) subText = `${date} · 已坚持 ${useStreak} 天`;
  else if (useStreak >= 3) subText = `${date} · 第 ${useStreak} 天`;

  return (
    <View className="flex-row items-start pb-1.5 pt-2.5">
      <View className="flex-1">
        {showGreeting ? (
          <View className="flex-row items-center">
            <Icon name="wave" size={20} color={color('primary')} />
            <Bold className="ml-1.5 text-[25px]">{title}</Bold>
          </View>
        ) : (
          <Bold className="text-[25px]">{title}</Bold>
        )}
        <TextMuted className="mt-1 text-[12.5px]">{subText}</TextMuted>
        {!remindersEnabled && (
          <View className="mt-1.5 self-start rounded-full bg-field px-2 py-1 dark:bg-field-d">
            <TextMuted className="text-[11px] font-medium">提醒已暂停</TextMuted>
          </View>
        )}
      </View>

      <HeaderIconButton accessibilityLabel="设置" onPress={onSettings}>
        <Icon name="settings" size={20} color={color('primary')} />
      </HeaderIconButton>
    </View>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start pb-1.5 pt-2.5">
      <View className="flex-1">
        <Bold className="text-[25px]">{title}</Bold>
        {subtitle ? <TextMuted className="mt-1 text-[12.5px]">{subtitle}</TextMuted> : null}
      </View>
      {action}
    </View>
  );
}
