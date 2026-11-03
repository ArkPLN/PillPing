import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/lib/theme';
import { pad2 } from '@/utils/number';

/** 时刻选择器：行内触发器 + 系统时间对话框。 */
export function TimeField({
  hour,
  minute,
  onChange,
  variant = 'md',
  testID,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  variant?: 'md' | 'compact';
  testID?: string;
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const compact = variant === 'compact';

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`时间 ${pad2(hour)}:${pad2(minute)}`}
        className={`flex-row items-center border border-line bg-field active:opacity-70 dark:border-line-d dark:bg-field-d ${
          compact
            ? 'min-h-[34px] gap-1 rounded-[9px] px-1.5 py-1.5'
            : 'gap-1.5 rounded-[10px] px-2.5 py-2'
        }`}
      >
        <Text
          maxFontSizeMultiplier={compact ? 1.2 : 1.3}
          className={`${compact ? 'text-[12.5px]' : 'text-[13px]'} font-bold tabular-nums text-ink dark:text-ink-d`}
        >
          {pad2(hour)}:{pad2(minute)}
        </Text>
        <Icon name="clock" size={compact ? 12 : 14} color={color('muted')} />
      </Pressable>

      {open && (
        <DateTimePicker
          value={new Date(2026, 0, 1, hour, minute)}
          mode="time"
          is24Hour
          display="default"
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) {
              onChange(date.getHours(), date.getMinutes());
            }
          }}
        />
      )}
    </>
  );
}
