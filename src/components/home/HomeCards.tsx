import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Medium, TextMuted } from '@/components/ui/Text';
import { dateKeyToCn } from '@/lib/format';
import type { HistoryItem } from '@/lib/types';

/** 药物快捷入口。 */
export function MedsShortcut({
  total,
  active,
  onPress,
}: {
  total: number;
  active: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-[18px] border border-line bg-card px-3.5 py-3 active:opacity-80 dark:border-line-d dark:bg-card-d"
    >
      <View className="flex-1">
        <Medium className="text-[13px]">药物</Medium>
        <TextMuted className="mt-0.5 text-[11px]">
          共 {total} 种 · {active} 种启用
        </TextMuted>
      </View>
      <Pill>管理</Pill>
    </Pressable>
  );
}

/** 最近记录（由 DoseRecord 派生）。 */
export function HistoryList({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) return null;
  return (
    <View className="rounded-[18px] border border-line bg-card px-3.5 py-3 dark:border-line-d dark:bg-card-d">
      {history.slice(0, 3).map((h, index) => (
        <View
          key={h.date}
          className={
            index === 0
              ? 'flex-row items-center py-1'
              : 'flex-row items-center border-t border-line py-1 dark:border-line-d'
          }
        >
          <TextMuted className="w-[72px] text-[11.5px]">{dateKeyToCn(h.date)}</TextMuted>
          <Text className="flex-1 text-[11.5px] text-ink dark:text-ink-d">{h.summary}</Text>
          <Text className="text-[11.5px] font-medium text-primary dark:text-primary-d">
            {h.taken}/{h.total}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function SectionHeader({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View className="mb-2 mt-4 flex-row items-center justify-between">
      <Text className="text-[15px] font-bold text-ink dark:text-ink-d">{title}</Text>
      {trailing ? <Pill>{trailing}</Pill> : null}
    </View>
  );
}
