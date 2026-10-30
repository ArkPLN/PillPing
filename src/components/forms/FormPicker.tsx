import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Pill';
import { Medium, TextMuted } from '@/components/ui/Text';
import { useTheme } from '@/lib/theme';
import { FORM_ICONS, FORM_LABELS, FORMS_ORDER, type FormKey } from '@/lib/icons';

/**
 * 剂型选择器，对应 legacy FormPicker.java。
 * 顶部是图标 + 名称 + 说明，下方是 6 个剂型 chip。
 */

const FORM_HINTS: Record<FormKey, string> = {
  tablet: '药片、糖衣片、薄膜衣片',
  capsule: '胶囊、软胶囊、胶丸',
  liquid: '口服液、糖浆、滴剂',
  injection: '注射液、粉针、安瓿',
  topical: '软膏、乳膏、喷雾、贴剂',
  other: '其他剂型',
};

export function FormPicker({
  value,
  onChange,
}: {
  value: FormKey;
  onChange: (form: FormKey) => void;
}) {
  const { isDark, color } = useTheme();
  const iconColor = isDark ? '#062E2A' : '#FFFFFF';

  return (
    <View className="rounded-2xl border border-line bg-field p-3.5 dark:border-line-d dark:bg-field-d">
      <View className="flex-row items-center">
        <View className="h-[46px] w-[46px] items-center justify-center rounded-full bg-mint dark:bg-mint-d">
          {/* 图标用主色，不用白色，确保在浅色背景可见 */}
          <Icon name={FORM_ICONS[value]} size={28} color={color('primary')} />
        </View>
        <View className="ml-2.5 flex-1">
          <Medium className="text-[13.5px]">剂型 · {FORM_LABELS[value]}</Medium>
          <TextMuted className="mt-0.5 text-[11px]">{FORM_HINTS[value]}</TextMuted>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-1.5">
        {FORMS_ORDER.map((f) => (
          <Chip
            key={f}
            label={FORM_LABELS[f]}
            selected={value === f}
            onPress={() => onChange(f)}
          />
        ))}
      </View>
    </View>
  );
}
