import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { View, type ColorValue } from 'react-native';

import CapsuleIcon from '@/assets/icons/capsule.svg';
import { ICONS, type IconKey } from '@/lib/icons';

type Props = {
  name: IconKey;
  size?: number;
  /**
   * React Navigation 的 tabBarIcon 回传的是 ColorValue；
   * 运行时实际都是字符串，这里统一收敛为 string 传给图标库。
   */
  color: ColorValue;
};

/**
 * 统一图标出口。对应 legacy Ui.icon()，但按 family 分派到不同图标库，
 * 并支持内嵌 SVG（胶囊）。
 */
export function Icon({ name, size = 22, color }: Props) {
  const spec = ICONS[name];
  const c = color as string;

  if (spec.family === 'capsule') {
    return <CapsuleIcon width={size} height={size} color={c} />;
  }
  if (spec.family === 'mci') {
    return <MaterialCommunityIcons name={spec.name} size={size} color={c} />;
  }
  return <MaterialIcons name={spec.name} size={size} color={c} />;
}

/** 圆形/圆角容器里的图标（对应 legacy 的 avatar / iconWrap 组合）。 */
export function IconAvatar({
  name,
  size = 24,
  color,
  boxSize = 42,
  className,
  rounded = 'full',
}: Props & { boxSize?: number; className?: string; rounded?: 'full' | 'xl' }) {
  return (
    <View
      style={{ width: boxSize, height: boxSize }}
      className={`items-center justify-center ${rounded === 'full' ? 'rounded-full' : 'rounded-xl'} ${className ?? ''}`}
    >
      <Icon name={name} size={size} color={color} />
    </View>
  );
}
