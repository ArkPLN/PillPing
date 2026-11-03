import React from 'react';
import { View } from 'react-native';

import { Chip } from '@/components/ui/Pill';
import { WEEKDAY_LABELS } from '@/constants/plan';

/** 星期多选：bit0=周一 … bit6=周日。 */
export function WeekdayPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (mask: number) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {WEEKDAY_LABELS.map((label, index) => {
        const selected = ((value >>> index) & 1) === 1;
        return (
          <Chip
            key={label}
            label={`周${label}`}
            selected={selected}
            onPress={() => onChange(value ^ (1 << index))}
          />
        );
      })}
    </View>
  );
}
