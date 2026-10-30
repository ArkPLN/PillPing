import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Bold, TextMuted } from '@/components/ui/Text';
import type { IconKey } from '@/lib/icons';

/**
 * 空态卡片，对应 legacy buildMeds() / buildSpecial() 里的 empty 分支。
 */
export function EmptyState({
  icon,
  title,
  desc,
  buttonLabel,
  buttonTone = 'primary',
  onAdd,
}: {
  icon: IconKey;
  title: string;
  desc: string;
  buttonLabel: string;
  buttonTone?: 'primary' | 'violet';
  onAdd: () => void;
}) {
  const isViolet = buttonTone === 'violet';

  return (
    <View className="items-center rounded-[20px] border border-line bg-card px-5 py-7 dark:border-line-d dark:bg-card-d">
      <View
        className={`h-16 w-16 items-center justify-center rounded-full ${
          isViolet ? 'bg-violet-bg dark:bg-violet-bg-d' : 'bg-mint dark:bg-mint-d'
        }`}
      >
        <Icon name={icon} size={28} color={isViolet ? '#7C3AED' : '#0F766E'} />
      </View>
      <Bold className="mt-3.5 text-center text-[17px]">{title}</Bold>
      <TextMuted className="mt-2 mb-4 text-center text-[12px] leading-[16px]">{desc}</TextMuted>
      <PrimaryButton
        label={buttonLabel}
        onPress={onAdd}
        className={`w-[180px] h-12 ${isViolet ? 'bg-violet dark:bg-violet-d' : ''}`}
      />
    </View>
  );
}

/** 虚线「添加」按钮，对应 legacy buildMeds 的 addMore。 */
export function AddMoreButton({
  label,
  tone = 'primary',
  onPress,
}: {
  label: string;
  tone?: 'primary' | 'violet';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`items-center justify-center rounded-[18px] border border-dashed py-3.5 active:opacity-70 ${
        tone === 'violet'
          ? 'border-violet-line dark:border-violet-line-d'
          : 'border-[#B9CCC6] dark:border-line-d'
      }`}
    >
      <Text
        className={`text-[14px] font-medium ${
          tone === 'violet'
            ? 'text-violet dark:text-violet-d'
            : 'text-primary dark:text-primary-d'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 顶部说明条，对应 legacy info 卡片。 */
export function InfoBanner({
  icon,
  text,
  tone = 'primary',
}: {
  icon: IconKey;
  text: string;
  tone?: 'primary' | 'violet';
}) {
  const isViolet = tone === 'violet';
  return (
    <View
      className={`flex-row items-start rounded-2xl px-3.5 py-3 ${
        isViolet ? 'bg-violet-bg dark:bg-violet-bg-d' : 'bg-mint dark:bg-mint-d'
      }`}
    >
      <Icon
        name={icon}
        size={18}
        color={isViolet ? '#7C3AED' : '#0F766E'}
      />
      <Text
        className={`ml-2 flex-1 text-[11.5px] leading-[16px] ${
          isViolet
            ? 'text-violet-text dark:text-violet-text-d'
            : 'text-primary-dark dark:text-primary-d'
        }`}
      >
        {text}
      </Text>
    </View>
  );
}
