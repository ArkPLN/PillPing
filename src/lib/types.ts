/**
 * 领域模型类型。
 *
 * 字段名刻意与 legacy Java 版的 JSON key 完全一致
 * （slotMask / actedAt / snoozeUntil / courseDays / followupDays / nextFollowupAt / code …），
 * 以便存储结构可对照，也便于未来做数据导入。
 */

/** 服药状态，对应 legacy Cycle.PENDING / TAKEN / SKIPPED。 */
export const DOSE_PENDING = 0;
export const DOSE_TAKEN = 1;
export const DOSE_SKIPPED = 2;

export type DoseStatus = typeof DOSE_PENDING | typeof DOSE_TAKEN | typeof DOSE_SKIPPED;

/** 每天最多服药次数，对应 legacy Cycle.MAX_DOSES。 */
export const MAX_DOSES = 12;

/** 一次疗程（今天这一轮）的服药状态。对应 legacy Cycle。 */
export type Cycle = {
  startDate: string;
  firstAt: number;
  count: number;
  planned: number[];
  status: DoseStatus[];
  actedAt: number[];
  snoozeUntil: number[];
};

/** 普通药物。对应 legacy Med。 */
export type Med = {
  id: string;
  name: string;
  dose: string;
  method: string;
  form: string;
  note: string;
  enabled: boolean;
  /** true = 每次服用（含以后新增的次数）。 */
  allDoses: boolean;
  /** allDoses 为 false 时使用；第 i 位 = 第 i 次。 */
  slotMask: number;
  color: number;
  /** 0 = 长期；否则为从 courseStart 起的天数。 */
  courseDays: number;
  courseStart: number;
  /** 0 = 不提醒复诊；否则为间隔天数。 */
  followupDays: number;
  nextFollowupAt: number;
};

/** 特殊用药。对应 legacy SpecialMed。 */
export const SPECIAL_MODE_INTERVAL = 0;
export const SPECIAL_MODE_DAILY = 1;

export type SpecialMode = typeof SPECIAL_MODE_INTERVAL | typeof SPECIAL_MODE_DAILY;

export type SpecialMed = {
  id: string;
  code: number;
  name: string;
  dose: string;
  method: string;
  form: string;
  note: string;
  enabled: boolean;
  mode: SpecialMode;
  intervalHours: number;
  hour: number;
  minute: number;
  nextAt: number;
  lastAt: number;
  snoozeUntil: number;
};

/** 历史记录条目。对应 legacy HistoryItem。 */
export type HistoryItem = {
  date: string;
  startAt: number;
  taken: number;
  total: number;
  summary: string;
};

/** 服药方式，对应 legacy Med.METHODS。 */
export const METHODS = [
  '口服',
  '含服',
  '舌下',
  '嚼服',
  '外用',
  '吸入',
  '注射',
  '其他',
] as const;

export type Method = (typeof METHODS)[number];
