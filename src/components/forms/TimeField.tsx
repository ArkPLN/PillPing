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
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1.5 rounded-[10px] border border-line bg-field px-2.5 py-2 active:opacity-70 dark:border-line-d dark:bg-field-d"
      >
        <Text className="text-[13px] font-bold tabular-nums text-ink dark:text-ink-d">
          {pad2(hour)}:{pad2(minute)}
        </Text>
        <Icon name="clock" size={14} color={color('muted')} />
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
