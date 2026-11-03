import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Medium, TextMuted } from '@/components/ui/Text';
import { VioletButton } from '@/components/ui/Button';
import { formatDurationShort, formatMonthDay, formatTime } from '@/lib/format';
import { effectiveAt, modeText, recordKeyFor, scheduleText } from '@/lib/specialmed';
import { formatDose } from '@/lib/units';
import type { SpecialMed } from '@/lib/types';
import { useTheme } from '@/lib/theme';

export function SpecialCard({
  med,
  now,
  onPress,
  onToggle,
  onTake,
  onBackfill,
  onSnooze,
}: {
  med: SpecialMed;
  now: number;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
  onTake: (recordKey: string) => void;
  onBackfill: (recordKey: string) => void;
  onSnooze: (recordKey: string) => void;
}) {
  const { color } = useTheme();
  const due = effectiveAt(med);
  const overdue = med.enabled && due > 0 && due <= now;
  const hasNext = med.enabled && due > 0;
  const recordKey = due > 0 ? recordKeyFor(due) : '';

  return (
    <Pressable
      onPress={onPress}
      className={`mb-2.5 rounded-[18px] border p-3.5 active:opacity-80 ${
        overdue
          ? 'border-amber-line bg-overdue-bg dark:border-amber-line-d dark:bg-overdue-bg-d'
          : 'border-line bg-card dark:border-line-d dark:bg-card-d'
      } ${med.enabled ? '' : 'opacity-55'}`}
    >
      <View className="flex-row items-center">
        <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-violet-bg dark:bg-violet-bg-d">
          <Icon name="clock" size={22} color={color('violet')} />
        </View>
        <View className="ml-2.5 flex-1">
          <Medium className="text-[14px]">{med.name}</Medium>
          <TextMuted className="mt-0.5 text-[11.5px]">
            {med.form} · {formatDose(med.doseQty, med.doseUnit)} · {med.method}
          </TextMuted>
        </View>
        <Switch
          value={med.enabled}
          onValueChange={onToggle}
          trackColor={{ false: '#D6D3D1', true: '#C4B5FD' }}
          thumbColor="#FFFFFF"
        />
        <Icon name="chevron" size={18} color={color('muted')} />
      </View>

      <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
        <Pill tone="violet">{modeText(med)}</Pill>
        {hasNext ? (
          <TextMuted className="text-[11.5px]">
            {formatMonthDay(due)} {formatTime(due)}
            {overdue ? ` · 已超时 ${formatDurationShort(now - due)}` : ''}
          </TextMuted>
        ) : (
          <TextMuted className="text-[11.5px]">已完成</TextMuted>
        )}
      </View>
      <TextMuted className="mt-1 text-[11px]">{scheduleText(med)}</TextMuted>

      {hasNext ? (
        <View className="mt-3 flex-row items-center gap-2">
          <View className="flex-1">
            <VioletButton label="已使用" onPress={() => onTake(recordKey)} />
          </View>
          <Pressable
            onPress={() => onSnooze(recordKey)}
            className="rounded-2xl border border-line px-3 py-2.5 active:opacity-70 dark:border-line-d"
          >
            <Text className="text-[12px] text-muted dark:text-muted-d">推迟</Text>
          </Pressable>
          <Pressable
            onPress={() => onBackfill(recordKey)}
            className="rounded-2xl border border-line px-3 py-2.5 active:opacity-70 dark:border-line-d"
          >
            <Text className="text-[12px] text-muted dark:text-muted-d">补登</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}
