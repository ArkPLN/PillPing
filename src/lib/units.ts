/**
 * 剂量单位与数量文本解析。
 *
 * 数量是文本输入（默认键盘），允许小数与「半」等中文数字写法；
 * 单位集合覆盖常见给药途径。
 */

export const UNITS = [
  '片',
  '粒',
  '颗',
  '丸',
  '袋',
  '包',
  '枚',
  '板',
  '盒',
  '贴',
  '喷',
  '揿',
  '吸',
  '涂',
  '滴',
  '泵',
  '支',
  '瓶',
  '杯',
  '勺',
  'mL',
  'mg',
  'g',
  'μg',
  '单位',
  'IU',
] as const;

export type DoseUnit = (typeof UNITS)[number];

export const DEFAULT_UNIT: DoseUnit = '片';

const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/**
 * 解析数量文本为数字。
 * 支持：阿拉伯数字（含小数）、「半」、一至九十九的中文数字（如「十二」）。
 * 解析失败返回 null。
 */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (t === '半') return 0.5;
  if (t in CN_DIGITS) return CN_DIGITS[t];

  if (t.includes('十')) {
    const [head, tail] = t.split('十');
    const tens = head ? CN_DIGITS[head] : 1;
    const ones = tail ? CN_DIGITS[tail] : 0;
    if (tens === undefined || ones === undefined) return null;
    return tens * 10 + ones;
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 组合数量与单位的展示文本；数量为空时返回空串。 */
export function formatDose(qty: string | undefined, unit: string): string {
  const q = (qty ?? '').trim();
  return q ? `${q}${unit}` : '';
}
