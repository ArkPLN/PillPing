import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import CapsuleIcon from '@/assets/icons/capsule.svg';

/**
 * 图标映射：对应 legacy/res/drawable 下的 15 个 VectorDrawable。
 * 逐一核对过 glyph 名在 @expo/vector-icons@15.1.1 中存在。
 * 例外：胶囊（ic_form_capsule）在 MaterialIcons / MaterialCommunityIcons
 * 中都没有等价 glyph，改用内嵌 SVG 保持与原版一致的视觉区分。
 */
export type IconFamily = 'mi' | 'mci' | 'capsule';

export type IconSpec =
  | { family: 'mi'; name: ComponentProps<typeof MaterialIcons>['name'] }
  | { family: 'mci'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { family: 'capsule' };

export const ICONS = {
  // Tab
  today: { family: 'mi', name: 'today' },
  pill: { family: 'mi', name: 'medication' },
  clock: { family: 'mi', name: 'schedule' },

  // 通用控件
  add: { family: 'mi', name: 'add' },
  minus: { family: 'mi', name: 'remove' },
  check: { family: 'mi', name: 'check' },
  close: { family: 'mi', name: 'close' },
  chevron: { family: 'mi', name: 'chevron-right' },
  chevronDown: { family: 'mi', name: 'expand-more' },
  settings: { family: 'mi', name: 'settings' },
  trash: { family: 'mi', name: 'delete' },
  bell: { family: 'mi', name: 'notifications' },
  notification: { family: 'mi', name: 'notifications' },

  // Material Symbols 图标
  calendar: { family: 'mi', name: 'calendar-month' },
  heart: { family: 'mi', name: 'monitor-heart' },
  wave: { family: 'mi', name: 'waving-hand' },

  // 剂型
  formTablet: { family: 'mi', name: 'medication' },
  formCapsule: { family: 'capsule' },
  formLiquid: { family: 'mci', name: 'bottle-tonic' },
  formInjection: { family: 'mci', name: 'needle' },
  formTopical: { family: 'mci', name: 'bandage' },
  formOther: { family: 'mci', name: 'dots-horizontal-circle-outline' },
} as const satisfies Record<string, IconSpec>;

export type IconKey = keyof typeof ICONS;

export const FORMS_ORDER = [
  'tablet',
  'capsule',
  'liquid',
  'injection',
  'topical',
  'other',
] as const;

export type FormKey = (typeof FORMS_ORDER)[number];

/** 剂型中文名，与 legacy Forms.NAMES 完全一致。 */
export const FORM_LABELS: Record<FormKey, string> = {
  tablet: '药片',
  capsule: '胶囊',
  liquid: '口服液',
  injection: '注射剂',
  topical: '外用',
  other: '其他',
};

/** 剂型 → 图标 key */
export const FORM_ICONS: Record<FormKey, IconKey> = {
  tablet: 'formTablet',
  capsule: 'formCapsule',
  liquid: 'formLiquid',
  injection: 'formInjection',
  topical: 'formTopical',
  other: 'formOther',
};
