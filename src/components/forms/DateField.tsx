import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/lib/theme';
import { dateKey, dateKeyToCn } from '@/lib/format';

function parse(key: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 日期选择器：行内触发器 + 系统日期对话框。 */
export function DateField({
  value,
  onChange,
  placeholder = '选择日期',
}: {
  value: string;
  onChange: (dateKeyString: string) => void;
  placeholder?: string;
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1.5 rounded-[10px] border border-line bg-field px-2.5 py-2 active:opacity-70 dark:border-line-d dark:bg-field-d"
      >
        <Text className="text-[13px] font-medium text-ink dark:text-ink-d">
          {value ? dateKeyToCn(value) : placeholder}
        </Text>
        <Icon name="calendar" size={14} color={color('muted')} />
      </Pressable>

      {open && (
        <DateTimePicker
          value={parse(value)}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) {
              onChange(dateKey(date.getTime()));
            }
          }}
        />
      )}
    </>
  );
}
