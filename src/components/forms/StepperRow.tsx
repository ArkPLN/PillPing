import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Medium, TextMuted } from '@/components/ui/Text';

/**
 * 步进器行（标题 + 副标题 + [-] 值 [+] + 输入）。
 * 对应 legacy 里反复出现的那段布局。
 */
export function StepperRow({
  title,
  subtitle,
  value,
  onMinus,
  onPlus,
  onInput,
  tone = 'primary',
}: {
  title: string;
  subtitle: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  onInput?: () => void;
  tone?: 'primary' | 'violet';
}) {
  const valueCls =
    tone === 'violet'
      ? 'text-violet dark:text-violet-d'
      : 'text-primary dark:text-primary-d';

  return (
    <View className="flex-row flex-wrap items-center">
      <View className="flex-1 pr-2">
        <Medium className="text-[13.5px]">{title}</Medium>
        <TextMuted className="mt-0.5 text-[11px]">{subtitle}</TextMuted>
      </View>

      <View className="flex-row items-center">
        <Pressable
          onPress={onMinus}
          className="h-9 w-9 items-center justify-center rounded-full bg-field active:opacity-70 dark:bg-field-d"
        >
          <Text className={`text-[18px] font-medium ${valueCls}`}>−</Text>
        </Pressable>

        <View className="min-w-[64px] items-center px-2">
          <Text className={`text-[14px] font-bold ${valueCls}`}>{value}</Text>
        </View>

        <Pressable
          onPress={onPlus}
          className="h-9 w-9 items-center justify-center rounded-full bg-field active:opacity-70 dark:bg-field-d"
        >
          <Text className={`text-[18px] font-medium ${valueCls}`}>+</Text>
        </Pressable>

        {onInput && (
          <Pressable onPress={onInput} className="ml-1.5 px-1.5 py-2 active:opacity-60">
            <Text className="text-[12px] font-medium text-primary dark:text-primary-d">输入</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
