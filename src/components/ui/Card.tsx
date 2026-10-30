import React from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * 卡片容器，对应 legacy Ui.card() / Ui.roundStroke(CARD, r, LINE, 1)。
 */
export function Card({
  className = '',
  children,
  ...rest
}: ViewProps & { className?: string; children?: React.ReactNode }) {
  return (
    <View
      {...rest}
      className={`rounded-[18px] border border-line bg-card dark:border-line-d dark:bg-card-d ${className}`}
    >
      {children}
    </View>
  );
}

/** 细分割线，对应 legacy Ui.line()。 */
export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px w-full bg-line dark:bg-line-d ${className}`} />;
}
