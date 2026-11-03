import React from 'react';
import { TextInput } from 'react-native';

import { useTheme } from '@/lib/theme';

/**
 * 数值/数量文本输入。默认键盘，允许「半」「1.5」等写法。
 */
export function NumericInput({
  value,
  onChangeText,
  placeholder,
  className,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  className?: string;
  accessibilityLabel?: string;
}) {
  const { color } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={color('muted')}
      accessibilityLabel={accessibilityLabel}
      className={
        className ??
        'rounded-[14px] border border-line bg-field px-3.5 py-3 text-[15px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d'
      }
    />
  );
}
