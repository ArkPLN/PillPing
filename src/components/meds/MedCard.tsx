import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Medium, TextMuted } from '@/components/ui/Text';
import { medColor } from '@/lib/colors';
import { courseText, followupText, planSummary } from '@/lib/med';
import { formatDose } from '@/lib/units';
import type { Med } from '@/lib/types';

export function MedCard({
  med,
  onPress,
  onToggle,
}: {
  med: Med;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const tint = medColor(med.color);
  const disabled = !med.enabled;

  return (
    <Pressable
      onPress={onPress}
      className={`mb-2.5 rounded-[18px] border border-line bg-card p-3.5 active:opacity-80 dark:border-line-d dark:bg-card-d ${
        disabled ? 'opacity-55' : ''
      }`}
    >
      <View className="flex-row items-center">
        <View
          className="h-[42px] w-[42px] items-center justify-center rounded-full"
          style={{ backgroundColor: tint }}
        >
          <Icon name="pill" size={22} color="#FFFFFF" />
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
          trackColor={{ false: '#D6D3D1', true: '#5EEAD4' }}
          thumbColor="#FFFFFF"
        />
        <Icon name="chevron" size={18} color="#A8A29E" />
      </View>

      <View className="mt-2.5 flex-row flex-wrap gap-1.5">
        <Pill>{planSummary(med)}</Pill>
        <Pill tone="muted">{courseText(med)}</Pill>
        {med.followupDays > 0 ? <Pill tone="violet">{followupText(med)}</Pill> : null}
      </View>

      {med.note ? (
        <Text className="mt-2 text-[11.5px] leading-[16px] text-muted dark:text-muted-d">
          {med.note}
        </Text>
      ) : null}
    </Pressable>
  );
}
