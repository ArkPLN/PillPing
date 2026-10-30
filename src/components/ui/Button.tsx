import React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

/**
 * 按钮原语，对应 legacy Ui.primaryButton / Ui.outlineButton。
 *
 * legacy 在深色模式下会把"亮底白字"自动改为深色字（ON_BRIGHT），
 * 这里用 dark:text-on-bright-d 保持同样效果。
 */

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  className?: string;
  textClassName?: string;
};

export function PrimaryButton({ label, className = '', textClassName = '', ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      className={`items-center justify-center rounded-2xl bg-primary px-4 py-3 active:opacity-80 dark:bg-primary-d ${className}`}
    >
      <Text className={`text-[15px] font-bold text-white dark:text-on-bright-d ${textClassName}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VioletButton({ label, className = '', textClassName = '', ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      className={`items-center justify-center rounded-2xl bg-violet px-4 py-3 active:opacity-80 dark:bg-violet-d ${className}`}
    >
      <Text className={`text-[15px] font-bold text-white dark:text-on-bright-d ${textClassName}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AmberButton({ label, className = '', textClassName = '', ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      className={`items-center justify-center rounded-2xl bg-amber px-4 py-3 active:opacity-80 dark:bg-amber-d ${className}`}
    >
      <Text className={`text-[15px] font-bold text-white dark:text-on-bright-d ${textClassName}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function OutlineButton({ label, className = '', textClassName = '', ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      className={`items-center justify-center rounded-2xl border border-line px-3.5 py-2.5 active:opacity-70 dark:border-line-d ${className}`}
    >
      <Text className={`text-[14px] font-medium text-ink-soft dark:text-ink-soft-d ${textClassName}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Hero 内的白色主按钮（对应 legacy 白底 + PRIMARY 字）。 */
export function HeroButton({ label, className = '', ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      className={`items-center justify-center rounded-2xl bg-white px-4 py-3 active:opacity-90 ${className}`}
    >
      <Text className="text-[15px] font-bold text-primary dark:text-on-white-d">{label}</Text>
    </Pressable>
  );
}

/** Hero 内的描边按钮（白字 + 半透明白边）。 */
export function HeroOutlineButton({ label, className = '', ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      className={`items-center justify-center rounded-2xl border border-white/40 px-3.5 py-2.5 active:opacity-80 ${className}`}
    >
      <Text className="text-[14px] font-medium text-white">{label}</Text>
    </Pressable>
  );
}
