import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { Bold, Medium, TextMuted } from '@/components/ui/Text';
import { formatDurationShort, formatTime } from '@/lib/format';
import { slotDose } from '@/lib/plan';
import { formatDose } from '@/lib/units';
import type { TimelineEntry } from '@/lib/timeline';
import { useTheme } from '@/lib/theme';

export function TimelineProgress({ taken, total }: { taken: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, taken / total) : 0;
  return (
    <View className="overflow-hidden rounded-[28px] bg-primary p-[22px] dark:bg-primary-d">
      <View
        pointerEvents="none"
        className="absolute -right-14 -top-[70px] h-[190px] w-[190px] rounded-full bg-white/10"
      />
      <Text className="text-[12px] font-medium tracking-wide text-white/80">今天</Text>
      <View className="mt-2 flex-row items-end gap-2">
        <Text className="text-[30px] font-bold leading-[34px] text-white">
          {taken}/{total}
        </Text>
        <Text className="mb-1 text-[13px] text-white/80">已服</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
        <View className="h-full rounded-full bg-white" style={{ width: `${ratio * 100}%` }} />
      </View>
    </View>
  );
}

export function TimelineCard({
  entry,
  now,
  isNext,
  onPress,
}: {
  entry: TimelineEntry;
  now: number;
  isNext: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const overdue = isNext && entry.status === 'missed';
  const due = entry.due;

  let cardCls = 'border-line bg-card dark:border-line-d dark:bg-card-d';
  if (isNext) {
    cardCls = overdue
      ? 'border-amber-line bg-overdue-bg dark:border-amber-line-d dark:bg-overdue-bg-d'
      : 'border-primary bg-next-bg dark:border-primary-d dark:bg-next-bg-d';
  }

  const dose = entry.slot ? slotDose(entry.med, entry.slot) : { qty: entry.med.doseQty, unit: entry.med.doseUnit };
  const doseText = formatDose(dose.qty, dose.unit) || `${entry.med.doseQty}${entry.med.doseUnit}`;

  let detail: string;
  let detailCls = 'text-muted-light dark:text-muted-light-d';
  if (entry.status === 'taken') {
    detail = `已服用 ${formatTime(entry.record?.actedAt || due)}`;
    detailCls = 'text-primary dark:text-primary-d';
  } else if (entry.status === 'skipped') {
    detail = '已跳过';
  } else if (entry.status === 'missed') {
    detail = `已漏服 · ${formatDurationShort(now - due)}前`;
  } else if (entry.record && entry.record.snoozeUntil > 0) {
    detail = `已推迟至 ${formatTime(due)}`;
  } else {
    detail = `计划 ${formatTime(entry.plannedAt)}`;
  }

  return (
    <Pressable
      onPress={onPress}
      className={`mb-2.5 flex-row items-center rounded-[18px] border p-3.5 active:opacity-80 ${cardCls}`}
    >
      <View className="w-[52px] items-start">
        <Bold className="text-[15px] tabular-nums text-ink dark:text-ink-d">{formatTime(due)}</Bold>
        {entry.slot?.label ? (
          <TextMuted className="mt-0.5 text-[10.5px]">{entry.slot.label}</TextMuted>
        ) : null}
      </View>
      <View className="mx-2 h-full w-px bg-line dark:bg-line-d" />
      <View className="flex-1">
        <Medium className="text-[13.5px]">{entry.med.name}</Medium>
        <TextMuted className="mt-0.5 text-[11.5px]">{doseText}</TextMuted>
        <Text className={`mt-1 text-[11px] ${detailCls}`}>{detail}</Text>
      </View>
      <View className="ml-2 items-end gap-1">
        {entry.status === 'taken' ? <Pill>已服</Pill> : null}
        {entry.status === 'pending' ? <Pill tone="muted">待服</Pill> : null}
        {entry.status === 'missed' ? <Pill tone="amber">已漏服</Pill> : null}
        {entry.status === 'skipped' ? <Pill tone="muted">已跳过</Pill> : null}
        <Icon name="chevron" size={16} color={color('muted')} />
      </View>
    </Pressable>
  );
}
