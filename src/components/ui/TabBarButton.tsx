import React from 'react';
import {
  Pressable,
  type PressableAndroidRippleConfig,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/lib/theme';

/**
 * 底部 Tab 按钮。
 *
 * React Navigation 默认给 tab 按钮传 `android_ripple: { borderless: true }`，
 * 配 32% 黑的默认颜色，涟漪会溢出按钮边界、盖住整条标签栏。
 * 这里改成有界、浅色、固定小半径的涟漪。
 */
type Props = Omit<PressableProps, 'onPress' | 'onLongPress' | 'style'> & {
  // 导航库的 onPress 可能来自 web 的 MouseEvent，这里放宽以免类型冲突。
  onPress?: ((e: any) => void) | null;
  onLongPress?: ((e: any) => void) | null;
  style?: StyleProp<ViewStyle>;
  'aria-selected'?: boolean;
  android_ripple?: PressableAndroidRippleConfig | null;
  hoverEffect?: unknown;
  pressOpacity?: number;
  href?: string;
};

export function TabBarButton({
  // 仅导航库使用，不应透传给 Pressable。
  hoverEffect: _hoverEffect,
  pressOpacity: _pressOpacity,
  href: _href,
  android_ripple,
  style,
  disabled,
  children,
  ...rest
}: Props) {
  const { isDark } = useTheme();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={style}
      android_ripple={{
        ...android_ripple,
        // 覆盖导航库的 borderless: true，让涟漪裁剪在按钮内部。
        borderless: false,
        radius: 26,
        color: isDark ? 'rgba(45, 212, 191, 0.10)' : 'rgba(15, 118, 110, 0.08)',
      }}
    >
      {children}
    </Pressable>
  );
}
