/**
 * 领域模型类型（v3 每药计划模型）。
 *
 * 与 legacy JSON 字段对齐的约束已在本版本废止：全局 Cycle / slotMask 被
 * 每药独立的 SchedulePlan + 按 (medId, slotKey, dateKey) 寻址的 DoseRecord 取代。
 */

/** 服药状态，沿用 legacy Cycle.PENDING / TAKEN / SKIPPED。 */
export const DOSE_PENDING = 0;
export const DOSE_TAKEN = 1;
export const DOSE_SKIPPED = 2;

export type DoseStatus = typeof DOSE_PENDING | typeof DOSE_TAKEN | typeof DOSE_SKIPPED;

/** 每天最多服药次数 / 每药最多时刻槽位。 */
export const MAX_DOSES = 12;

/** 计划类型：每天固定、按周循环、按间隔。 */
export type PlanType = 'daily' | 'weekly' | 'interval';

/** 计划中的一个时刻槽位。id 稳定，作为剂量记录的 slotKey。 */
export type PlanSlot = {
  id: string;
  hour: number;
  minute: number;
  /** 服用时机标签：早/中/晚/饭前/饭后/睡前等，仅用于文案。 */
  label?: string;
  /** 槽位级数量；留空回退到药物级。 */
  qty?: string;
  /** 槽位级单位；默认与药物级一致。 */
  unit: string;
};

/** 每天固定时刻。 */
export type DailyPlan = {
  type: 'daily';
  slots: PlanSlot[];
};

/** 按周循环：bit0=周一 … bit6=周日。 */
export type WeeklyPlan = {
  type: 'weekly';
  daysMask: number;
  slots: PlanSlot[];
};

/** 按间隔：下一次 = 该药最近一次实际服用 + intervalHours。 */
export type IntervalPlan = {
  type: 'interval';
  intervalHours: number;
  dosesPerDay: number;
  /** 尚无实际记录时的首剂时刻。 */
  firstTime: { hour: number; minute: number };
};

export type SchedulePlan = DailyPlan | WeeklyPlan | IntervalPlan;

/** 普通药物。 */
export type Med = {
  id: string;
  name: string;
  /** 药物级数量，文本形式（可输入「半」「1.5」）。 */
  doseQty: string;
  /** 药物级单位，默认「片」。 */
  doseUnit: string;
  method: string;
  form: string;
  note: string;
  enabled: boolean;
  plan: SchedulePlan;
  color: number;
  /** 0 = 长期；否则为从 courseStart 起的天数。 */
  courseDays: number;
  courseStart: number;
  /** 0 = 不提醒复诊；否则为最后一天服药后的第 N 天。 */
  followupDays: number;
  nextFollowupAt: number;
};

/** 一次剂量的记录，身份 = (medId, slotKey, dateKey)。 */
export type DoseRecord = {
  medId: string;
  slotKey: string;
  dateKey: string;
  /** 记录时刻对应的计划时刻（槽位被删除后仍可展示）。 */
  plannedAt: number;
  status: DoseStatus;
  actedAt: number;
  snoozeUntil: number;
};

/** 可复用的计划模板（复制语义，仅保存快照）。 */
export type SavedPlan = {
  id: string;
  name: string;
  plan: SchedulePlan;
};

/** 特殊用药的三种非常规形态。 */
export const SPECIAL_MODE_ONCE = 'once';
export const SPECIAL_MODE_WEEKLY = 'weekly-count';
export const SPECIAL_MODE_DATES = 'dates';

export type SpecialMode =
  | typeof SPECIAL_MODE_ONCE
  | typeof SPECIAL_MODE_WEEKLY
  | typeof SPECIAL_MODE_DATES;

/** 特殊用药的一次已完成记录。 */
export type SpecialRecord = {
  key: string;
  due: number;
  status: DoseStatus;
  actedAt: number;
  snoozeUntil: number;
};

/** 特殊用药。 */
export type SpecialMed = {
  id: string;
  code: number;
  name: string;
  doseQty: string;
  doseUnit: string;
  method: string;
  form: string;
  note: string;
  enabled: boolean;
  mode: SpecialMode;
  /** once：单个日期（YYYY-MM-DD）。 */
  onceDate: string;
  /** once / dates：当天时刻列表（HH:mm）；weekly-count 使用 times[0] 或默认 09:00。 */
  times: string[];
  /** dates：单选或多选日期（YYYY-MM-DD）。 */
  dates: string[];
  /** weekly-count：每周目标次数。 */
  weeklyTarget: number;
  /** weekly-count：每 N 天推进一次。 */
  weeklyStepDays: number;
  /** 已完成的剂量记录。 */
  records: SpecialRecord[];
  /** 下一次到点时刻；0 = 无后续。 */
  nextAt: number;
  /** 最近一次实际使用时刻。 */
  lastAt: number;
  /** 推迟目标时刻；优先于 nextAt。 */
  snoozeUntil: number;
};

/** 历史记录条目（由 DoseRecord 派生，不再持久化）。 */
export type HistoryItem = {
  date: string;
  taken: number;
  total: number;
  summary: string;
};

/** 服药方式。 */
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
