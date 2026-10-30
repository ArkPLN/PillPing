/**
 * 剂型推断。对应 legacy Forms.java。
 *
 * 关键词优先级必须与 legacy 完全一致，否则旧药物推断出的剂型会变。
 * 顺序：注射 → 外用/吸入 → 胶囊 → 口服液 → 药片 → 默认药片
 */

export const FORM_TABLET = '药片';
export const FORM_CAPSULE = '胶囊';
export const FORM_LIQUID = '口服液';
export const FORM_INJECTION = '注射剂';
export const FORM_TOPICAL = '外用';
export const FORM_OTHER = '其他';

/** 对应 legacy Forms.NAMES 的顺序。 */
export const FORM_NAMES = [
  FORM_TABLET,
  FORM_CAPSULE,
  FORM_LIQUID,
  FORM_INJECTION,
  FORM_TOPICAL,
  FORM_OTHER,
] as const;

export type FormName = (typeof FORM_NAMES)[number];

/** 对应 legacy Forms.indexOf：未知值回落到 0（药片）。 */
export function formIndexOf(form: string): number {
  const i = FORM_NAMES.indexOf(form as FormName);
  return i < 0 ? 0 : i;
}

/**
 * 对应 legacy Forms.infer(name, dose, method)。
 * 注意：legacy 用 toLowerCase(Locale.CHINA)，对中文无影响，
 * 但对 "ml" / "ML" 这类英文缩写有效，这里保留。
 */
export function inferForm(name: string, dose: string, method: string): FormName {
  const n = name ?? '';
  const d = dose ?? '';
  const m = method ?? '';
  const all = `${n} ${d} ${m}`.toLowerCase();

  if (m.includes('注射') || all.includes('注射') || all.includes('针剂') || all.includes('安瓿')) {
    return FORM_INJECTION;
  }
  if (
    m.includes('外用') ||
    m.includes('吸入') ||
    all.includes('软膏') ||
    all.includes('乳膏') ||
    all.includes('喷雾') ||
    all.includes('贴')
  ) {
    return FORM_TOPICAL;
  }
  if (all.includes('胶囊') || all.includes('胶丸')) return FORM_CAPSULE;
  if (
    d.includes('ml') ||
    d.includes('毫升') ||
    all.includes('口服液') ||
    all.includes('糖浆') ||
    all.includes('滴剂') ||
    all.includes('溶液')
  ) {
    return FORM_LIQUID;
  }
  if (all.includes('片') || all.includes('粒') || all.includes('丸')) return FORM_TABLET;
  return FORM_TABLET;
}
