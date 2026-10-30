import React from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';

/** 胶囊标签，对应 legacy Ui.pill(text, textColor, bgColor)。 */
type PillTone = 'primary' | 'muted' | 'danger' | 'amber' | 'violet' | 'onHero';

const PILL: Record<PillTone, { wrap: string; text: string }> = {
  primary: {
    wrap: 'bg-mint dark:bg-mint-d',
    text: 'text-primary dark:text-primary-d',
  },
  muted: {
    wrap: 'bg-field dark:bg-field-d',
    text: 'text-muted dark:text-muted-d',
  },
  danger: {
    wrap: 'bg-danger-bg dark:bg-danger-bg-d',
    text: 'text-danger dark:text-danger-d',
  },
  amber: {
    wrap: 'bg-amber-bg dark:bg-amber-bg-d',
    text: 'text-amber dark:text-amber-d',
  },
  violet: {
    wrap: 'bg-violet-bg dark:bg-violet-bg-d',
    text: 'text-violet-text dark:text-violet-text-d',
  },
  onHero: {
    wrap: 'bg-white/15',
    text: 'text-white',
  },
};

export function Pill({
  children,
  tone = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  const s = PILL[tone];
  return (
    <View className={`items-center justify-center rounded-full px-[9px] py-1 ${s.wrap} ${className}`}>
      <Text className={`text-[11px] font-medium ${s.text}`}>{children}</Text>
    </View>
  );
}

/** 可选中的 chip，对应 legacy Ui.chip(text, selected)。 */
export function Chip({
  label,
  selected = false,
  onPress,
  className = '',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-[7px] ${
        selected
          ? 'border-primary/35 bg-mint dark:border-primary-d/35 dark:bg-mint-d'
          : 'border-line bg-field dark:border-line-d dark:bg-field-d'
      } ${className}`}
    >
      <Text
        className={`text-[12.5px] font-medium ${
          selected ? 'text-primary dark:text-primary-d' : 'text-ink-soft dark:text-ink-soft-d'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 圆形步进按钮（+ / -），对应 legacy stepButton()。 */
export function StepButton({
  onPress,
  children,
  disabled = false,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-9 w-9 items-center justify-center rounded-full bg-field dark:bg-field-d ${
        disabled ? 'opacity-40' : 'active:opacity-70'
      }`}
    >
      {children}
    </Pressable>
  );
}

/** 通用可点击容器（对应 legacy 里手动 setClickable + ripple 的卡片）。 */
export function PressableCard({
  children,
  onPress,
  className = '',
  ...rest
}: ViewProps & { onPress?: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-[18px] border border-line bg-card active:opacity-80 dark:border-line-d dark:bg-card-d ${className}`}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
