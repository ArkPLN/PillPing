import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Medium, TextMuted } from '@/components/ui/Text';
import { OutlineButton, VioletButton } from '@/components/ui/Button';
import { dayLabel, formatDurationShort, formatTime } from '@/lib/format';
import { FORM_ICONS, FORM_LABELS, type FormKey } from '@/lib/icons';
import { effectiveAt, scheduleText } from '@/lib/specialmed';
import type { SpecialMed } from '@/lib/types';
import { useTheme } from '@/lib/theme';

function formKeyOf(form: string): FormKey {
  const entry = (Object.keys(FORM_LABELS) as FormKey[]).find((k) => FORM_LABELS[k] === form);
  return entry ?? 'tablet';
}

/** 特殊用药卡片，对应 legacy buildSpecialCard()。 */
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
  onTake: () => void;
  onBackfill: () => void;
  onSnooze: () => void;
}) {
  const { color, isDark } = useTheme();
  const due = effectiveAt(med);

  let status: string;
  let statusCls: string;
  if (!med.enabled) {
    status = '已停用';
    statusCls = 'text-muted dark:text-muted-d';
  } else if (due <= now) {
    status = now - due < 60_000 ? '已到时间' : `已超时 ${formatDurationShort(now - due)}`;
    statusCls = 'text-amber dark:text-amber-d';
  } else {
    status = `下次 ${dayLabel(due)} ${formatTime(due)}`;
    statusCls = 'text-violet-text dark:text-violet-text-d';
  }

  return (
    <Pressable
      onPress={onPress}
      className="rounded-[18px] border border-line bg-card p-3.5 active:opacity-80 dark:border-line-d dark:bg-card-d"
      style={{ opacity: med.enabled ? 1 : 0.62 }}
    >
      <View className="flex-row items-center">
        <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-violet dark:bg-violet-d">
          <Icon
            name={FORM_ICONS[formKeyOf(med.form)]}
            size={24}
            color={isDark ? '#062E2A' : '#FFFFFF'}
          />
        </View>

        <View className="ml-2.5 flex-1">
          <Medium className="text-[15.5px]">{med.name}</Medium>
          <TextMuted className="mt-0.5 text-[12px]">
            {med.form}  ·  {med.dose}  ·  {med.method}
          </TextMuted>
        </View>

        <Switch
          value={med.enabled}
          onValueChange={onToggle}
          trackColor={{ true: '#7C3AED66', false: color('line') }}
          thumbColor={med.enabled ? '#7C3AED' : '#C7D2CE'}
          accessibilityLabel={`${med.name} ${med.enabled ? '已启用' : '已停用'}`}
        />
        <View className="ml-1">
          <Icon name="chevron" size={16} color={color('mutedLight')} />
        </View>
      </View>

      {/* 节奏 + 下次状态 */}
      <View className="mt-2.5 flex-row items-center">
        <Pill tone="violet">{scheduleText(med)}</Pill>
        <Text className={`ml-2 flex-1 text-[11.5px] ${statusCls}`}>{status}</Text>
      </View>

      {med.lastAt > 0 && (
        <TextMuted className="mt-1.5 text-[11px]">
          上次服用 {dayLabel(med.lastAt)} {formatTime(med.lastAt)}
        </TextMuted>
      )}

      {/* 操作 */}
      <View className="mt-2.5 flex-row items-center gap-2">
        <VioletButton label="已服用" className="h-[42px] flex-1" onPress={onTake} />
        <OutlineButton label="补登" className="h-[42px] flex-1" onPress={onBackfill} />
        <Pressable
          onPress={onSnooze}
          className="h-[42px] w-[46px] items-center justify-center active:opacity-70"
        >
          <TextMuted className="text-[12.5px]">推迟</TextMuted>
        </Pressable>
      </View>
    </Pressable>
  );
}
