import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Medium, TextMuted } from '@/components/ui/Text';
import { MED_COLORS, medColor } from '@/lib/colors';
import { courseText, isCourseActive, isSlot } from '@/lib/med';
import { formatMonthDay } from '@/lib/format';
import { FORM_ICONS, FORM_LABELS, type FormKey } from '@/lib/icons';
import type { Med } from '@/lib/types';
import { useTheme } from '@/lib/theme';

function formKeyOf(form: string): FormKey {
  const entry = (Object.keys(FORM_LABELS) as FormKey[]).find((k) => FORM_LABELS[k] === form);
  return entry ?? 'tablet';
}

/** 药物卡片，对应 legacy buildMedCard()。 */
export function MedCard({
  med,
  doseCount,
  onPress,
  onToggle,
}: {
  med: Med;
  doseCount: number;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const { color, isDark } = useTheme();
  const ended = med.courseDays > 0 && !isCourseActive(med);

  // 剂型头像
  const avatarColor = medColor(med.color);
  const iconColor = isDark ? '#062E2A' : '#FFFFFF';

  // 服用时机 chips
  const slots: number[] = [];
  if (!med.allDoses) {
    for (let i = 0; i < doseCount; i++) if (isSlot(med, i)) slots.push(i);
  }

  return (
    <Pressable
      onPress={onPress}
      className="rounded-[18px] border border-line bg-card p-3.5 active:opacity-80 dark:border-line-d dark:bg-card-d"
      style={{ opacity: !med.enabled ? 0.62 : ended ? 0.78 : 1 }}
    >
      {/* 头部：头像 + 名称 + 开关 + 箭头 */}
      <View className="flex-row items-center">
        <View
          className="h-[42px] w-[42px] items-center justify-center rounded-full"
          style={{ backgroundColor: avatarColor }}
        >
          <Icon name={FORM_ICONS[formKeyOf(med.form)]} size={24} color={iconColor} />
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
          trackColor={{ true: avatarColor + '66', false: color('line') }}
          thumbColor={med.enabled ? avatarColor : '#C7D2CE'}
          accessibilityLabel={`${med.name} ${med.enabled ? '已启用' : '已停用'}`}
        />
        <View className="ml-1">
          <Icon name="chevron" size={16} color={color('mutedLight')} />
        </View>
      </View>

      {/* 服用时机 */}
      <View className="mt-2.5 flex-row flex-wrap gap-1.5">
        {med.allDoses ? (
          <Pill>每次服用</Pill>
        ) : slots.length > 0 ? (
          slots.map((i) => <Pill key={i}>第{i + 1}次</Pill>)
        ) : (
          <Pill tone="muted">未指定</Pill>
        )}
      </View>

      {/* 疗程 / 复诊 */}
      {(med.courseDays > 0 || med.followupDays > 0) && (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          <Pill tone={ended ? 'danger' : 'amber'}>{courseText(med)}</Pill>
          {med.followupDays > 0 && med.nextFollowupAt > 0 && !ended && (
            <Pill tone="violet">复诊 {formatMonthDay(med.nextFollowupAt)}</Pill>
          )}
        </View>
      )}

      {/* 备注 */}
      {!!med.note && <TextMuted className="mt-2 text-[11.5px]">{med.note}</TextMuted>}
    </Pressable>
  );
}
