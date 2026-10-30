import React from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

/**
 * 输入框，对应 legacy Sheet.input() / multiline()。
 */
export function Field({
  multiline = false,
  className = '',
  ...rest
}: TextInputProps & { className?: string }) {
  return (
    <View className="w-full">
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor="#93A19D"
        className={`w-full rounded-[14px] border border-line bg-field px-3.5 py-3 text-[15px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d ${
          multiline ? 'min-h-[76px] text-top' : ''
        } ${className}`}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}
