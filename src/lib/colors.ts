/**
 * 颜色 token 的运行时出口。
 *
 * 唯一真源是 tailwind.config.js 的 colors；本文件镜像同一组值，
 * 供无法使用 className 的场景（通知渠道色、导航栏、StatusBar、
 * SVG fill、TimePicker themeVariant 等）使用。
 *
 * 约定：键名为语义名（不含 -d 后缀），值是 { light, dark } 二元组。
 */

export type ColorPair = { light: string; dark: string };
export type ColorToken =
  | 'bg'
  | 'card'
  | 'ink'
  | 'inkSoft'
  | 'muted'
  | 'mutedLight'
  | 'primary'
  | 'primaryDark'
  | 'primaryLight'
  | 'mint'
  | 'mintStrong'
  | 'line'
  | 'field'
  | 'amber'
  | 'amberBg'
  | 'amberLine'
  | 'danger'
  | 'dangerBg'
  | 'violet'
  | 'violetBg'
  | 'violetLine'
  | 'violetText'
  | 'nextBg'
  | 'overdueBg'
  | 'onWhite'
  | 'onBright';

export const COLORS: Record<ColorToken, ColorPair> = {
  bg: { light: '#F5F8F7', dark: '#0B1210' },
  card: { light: '#FFFFFF', dark: '#141F1C' },
  ink: { light: '#12211E', dark: '#EAF4F1' },
  inkSoft: { light: '#33423E', dark: '#C6D5D0' },
  muted: { light: '#64746F', dark: '#93A49F' },
  mutedLight: { light: '#93A19D', dark: '#6D7F79' },
  primary: { light: '#0F766E', dark: '#2DD4BF' },
  primaryDark: { light: '#0B5D56', dark: '#14B8A6' },
  primaryLight: { light: '#14B8A6', dark: '#5EEAD4' },
  mint: { light: '#E6F4F1', dark: '#183A33' },
  mintStrong: { light: '#CCEAE4', dark: '#1F4A40' },
  line: { light: '#E4ECE9', dark: '#263A34' },
  field: { light: '#F3F7F5', dark: '#1A2925' },
  amber: { light: '#B45309', dark: '#FBBF24' },
  amberBg: { light: '#FFF7E6', dark: '#3A2A12' },
  amberLine: { light: '#F6DFAF', dark: '#6B4E1F' },
  danger: { light: '#B3261E', dark: '#F87171' },
  dangerBg: { light: '#FDECEA', dark: '#3B1D1D' },
  violet: { light: '#7C3AED', dark: '#A78BFA' },
  violetBg: { light: '#F3E8FF', dark: '#2A1E3F' },
  violetLine: { light: '#C4B5FD', dark: '#4C3A6B' },
  violetText: { light: '#6D28D9', dark: '#D8B4FE' },
  nextBg: { light: '#F0FBF8', dark: '#102C27' },
  overdueBg: { light: '#FFF8EC', dark: '#332711' },
  onWhite: { light: '#0F766E', dark: '#062E2A' },
  onBright: { light: '#062E2A', dark: '#062E2A' },
};

/** Palette.MED_COLORS —— 药物头像配色，亮暗通用。 */
export const MED_COLORS = [
  '#0F766E',
  '#2563EB',
  '#C2410C',
  '#7C3AED',
  '#BE123C',
  '#0369A1',
  '#4D7C0F',
] as const;

export function medColor(index: number): string {
  const len = MED_COLORS.length;
  const i = ((index % len) + len) % len;
  return MED_COLORS[i];
}

export function pick(token: ColorToken, isDark: boolean): string {
  return isDark ? COLORS[token].dark : COLORS[token].light;
}
