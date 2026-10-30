import React from 'react';
import { Text, type TextProps } from 'react-native';

/**
 * 文本原语，对应 legacy Ui.text / Ui.medium / Ui.bold 与常用字号。
 * 颜色通过 className 传入（如 text-ink dark:text-ink-d）。
 */
type Base = TextProps & { className?: string };

export function TextBody({ className = '', ...rest }: Base) {
  return <Text {...rest} className={`text-ink dark:text-ink-d ${className}`} />;
}

export function TextMuted({ className = '', ...rest }: Base) {
  return <Text {...rest} className={`text-muted dark:text-muted-d ${className}`} />;
}

export function TextMutedLight({ className = '', ...rest }: Base) {
  return <Text {...rest} className={`text-muted-light dark:text-muted-light-d ${className}`} />;
}

export function TextPrimary({ className = '', ...rest }: Base) {
  return <Text {...rest} className={`text-primary dark:text-primary-d ${className}`} />;
}

export function TextDanger({ className = '', ...rest }: Base) {
  return <Text {...rest} className={`text-danger dark:text-danger-d ${className}`} />;
}

export function TextAmber({ className = '', ...rest }: Base) {
  return <Text {...rest} className={`text-amber dark:text-amber-d ${className}`} />;
}

export function TextViolet({ className = '', ...rest }: Base) {
  return <Text {...rest} className={`text-violet-text dark:text-violet-text-d ${className}`} />;
}

/** 中黑（sans-serif-medium 等价）。 */
export function Medium({ className = '', ...rest }: Base) {
  return <TextBody {...rest} className={`font-medium ${className}`} />;
}

/** 加粗。 */
export function Bold({ className = '', ...rest }: Base) {
  return <TextBody {...rest} className={`font-bold ${className}`} />;
}
