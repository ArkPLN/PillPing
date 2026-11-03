import React from 'react';
import { View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import { useTheme } from '@/lib/theme';

export type SelectOption = { value: string; label: string };

/**
 * 固定枚举下拉。Android 使用原生 dropdown。
 */
export function SelectField({
  value,
  options,
  onChange,
  enabled = true,
  placeholder,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  enabled?: boolean;
  placeholder?: string;
}) {
  const { color } = useTheme();
  return (
    <View className="overflow-hidden rounded-[14px] border border-line bg-field dark:border-line-d dark:bg-field-d">
      <Picker
        selectedValue={value}
        onValueChange={(v) => onChange(String(v))}
        enabled={enabled}
        mode="dropdown"
        dropdownIconColor={color('muted')}
        style={{ color: color('ink'), height: 46 }}
      >
        {placeholder ? <Picker.Item label={placeholder} value="" color={color('muted')} /> : null}
        {options.map((o) => (
          <Picker.Item key={o.value} label={o.label} value={o.value} color={color('ink')} />
        ))}
      </Picker>
    </View>
  );
}
