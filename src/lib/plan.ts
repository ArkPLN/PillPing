/**
 * 每药服药计划的派生。
 *
 * 计划时刻是派生数据，不持久化：
 * - daily / weekly：槽位直接映射到当天时刻；
 * - interval：下一次 = 该药最近一次实际服用 + 间隔（锚点链，按药隔离）。
 *
 * 记录身份 = (medId, slotKey, dateKey)。daily/weekly 的 slotKey 使用稳定槽位 id；
 * interval 的槽位是滚动生成的，slotKey 使用 `iv-<计划时刻>`，避免锚点移动后串位。
 */

import { HOUR_MS } from '../constants/time';
import { MAX_DOSES, DOSE_PENDING, DOSE_SKIPPED, DOSE_TAKEN, type DoseRecord, type Med, type PlanSlot, type SchedulePlan } from './types';
import { effectiveDue } from './effective';

export type PlanEntryStatus = 'pending' | 'taken' | 'skipped' | 'missed';

export type PlanEntry = {
  medId: string;
  slotKey: string;
  dateKey: string;
  plannedAt: number;
  due: number;
  status: PlanEntryStatus;
  slot?: PlanSlot;
  record?: DoseRecord;
};

/** 解析 YYYY-MM-DD 为本地零点时间戳。 */
export function dayStartOf(dateKeyString: string): number {
  const [y, m, d] = dateKeyString.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/** 某天某时刻的本地时间戳。 */
export function timeAt(dateKeyString: string, hour: number, minute: number): number {
  const [y, m, d] = dateKeyString.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0).getTime();
}

/** 解析 HH:mm。 */
export function parseTimeText(text: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** 星期索引：0=周一 … 6=周日。 */
export function weekdayIndexOf(dateKeyString: string): number {
  return (new Date(dayStartOf(dateKeyString)).getDay() + 6) % 7;
}

export function isDayInPlan(plan: SchedulePlan, dateKeyString: string): boolean {
  if (plan.type !== 'weekly') return true;
  return ((plan.daysMask >>> weekdayIndexOf(dateKeyString)) & 1) === 1;
}

export function planSlots(plan: SchedulePlan): PlanSlot[] {
  return plan.type === 'interval' ? [] : plan.slots;
}

/** 取某槽位的实际用量（槽位缺省回退药物级）。 */
export function slotDose(med: Med, slot: PlanSlot): { qty: string; unit: string } {
  const qty = (slot.qty ?? '').trim() || med.doseQty;
  return { qty, unit: slot.unit || med.doseUnit };
}

/** 查找某剂量的记录。 */
export function findRecord(
  records: DoseRecord[],
  medId: string,
  slotKey: string,
  dateKeyString: string
): DoseRecord | undefined {
  return records.find(
    (r) => r.medId === medId && r.slotKey === slotKey && r.dateKey === dateKeyString
  );
}

function statusOf(record: DoseRecord | undefined, due: number, now: number): PlanEntryStatus {
  if (record?.status === DOSE_TAKEN) return 'taken';
  if (record?.status === DOSE_SKIPPED) return 'skipped';
  return due < now ? 'missed' : 'pending';
}

function entryFromSlot(
  med: Med,
  slot: PlanSlot,
  dateKeyString: string,
  records: DoseRecord[],
  now: number
): PlanEntry {
  const plannedAt = timeAt(dateKeyString, slot.hour, slot.minute);
  const record = findRecord(records, med.id, slot.id, dateKeyString);
  const due = effectiveDue(record?.snoozeUntil ?? 0, plannedAt);
  return {
    medId: med.id,
    slotKey: slot.id,
    dateKey: dateKeyString,
    plannedAt: record?.plannedAt || plannedAt,
    due,
    status: statusOf(record, due, now),
    slot,
    record,
  };
}

/** 最近一次实际服用（TAKEN 且 actedAt > 0）。 */
function latestTaken(medId: string, records: DoseRecord[]): DoseRecord | undefined {
  let best: DoseRecord | undefined;
  for (const r of records) {
    if (r.medId !== medId) continue;
    if (r.status !== DOSE_TAKEN || r.actedAt <= 0) continue;
    if (!best || r.actedAt > best.actedAt) best = r;
  }
  return best;
}

/**
 * interval 型计划在某天的剂量。
 *
 * 规则：从该药最近一次实际服用 + 间隔开始滚动；从未服用时从当天 firstTime 开始。
 * 当天已有记录原样并入（保证历史与今日进度不丢），滚动生成的待服剂量按
 * 当天已记录数量 + dosesPerDay 截断。
 */
function intervalEntries(
  med: Med,
  records: DoseRecord[],
  dateKeyString: string,
  now: number
): PlanEntry[] {
  if (med.plan.type !== 'interval') return [];
  const plan = med.plan;
  const dayStart = dayStartOf(dateKeyString);
  const dayEnd = dayStart + 24 * HOUR_MS;
  const step = Math.max(1, plan.intervalHours) * HOUR_MS;
  const dosesPerDay = Math.max(1, Math.min(MAX_DOSES, plan.dosesPerDay));

  const dayRecords = records
    .filter((r) => r.medId === med.id && r.dateKey === dateKeyString)
    .sort((a, b) => (a.plannedAt || a.actedAt) - (b.plannedAt || b.actedAt));

  const entries: PlanEntry[] = dayRecords.map((r) => {
    const plannedAt = r.plannedAt || r.actedAt;
    const due = effectiveDue(r.snoozeUntil, plannedAt);
    return {
      medId: med.id,
      slotKey: r.slotKey,
      dateKey: dateKeyString,
      plannedAt,
      due,
      status: statusOf(r, due, now),
      record: r,
    };
  });

  const anchor = latestTaken(med.id, records);
  let cursor: number;
  if (anchor) {
    cursor = anchor.actedAt + step;
  } else {
    cursor = timeAt(dateKeyString, plan.firstTime.hour, plan.firstTime.minute);
    // 若没有锚点但当天已过去，仍按 firstTime 生成（过期即漏服）
  }

  // 跳过早于当天的滚动时刻（保持 O(1) 级对齐）
  if (cursor < dayStart) {
    const k = Math.ceil((dayStart - cursor) / step);
    cursor += k * step;
  }

  const remaining = Math.max(0, dosesPerDay - dayRecords.length);
  let generated = 0;
  while (cursor < dayEnd && generated < remaining) {
    const slotKey = `iv-${cursor}`;
    entries.push({
      medId: med.id,
      slotKey,
      dateKey: dateKeyString,
      plannedAt: cursor,
      due: cursor,
      status: cursor < now ? 'missed' : 'pending',
    });
    cursor += step;
    generated += 1;
  }

  return entries.sort((a, b) => a.due - b.due);
}

/**
 * 派生某药在某天的全部剂量。
 * @param med 药物
 * @param records 全部剂量记录
 * @param dateKeyString YYYY-MM-DD
 * @param now 当前时刻（默认 Date.now()）
 */
export function projectDay(
  med: Med,
  records: DoseRecord[],
  dateKeyString: string,
  now = Date.now()
): PlanEntry[] {
  if (!med.enabled) return [];
  if (!isDayInPlan(med.plan, dateKeyString)) return [];

  if (med.plan.type === 'interval') {
    return intervalEntries(med, records, dateKeyString, now);
  }

  return med.plan.slots.map((slot) => entryFromSlot(med, slot, dateKeyString, records, now));
}

/** 取某天的日期字符串（用于跨天遍历）。 */
export function dateKeyAt(dateKeyString: string, offsetDays: number): string {
  const d = new Date(dayStartOf(dateKeyString));
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad(m)}-${pad(day)}`;
}

/** 判断一个剂量是否为未处理（待服或漏服）。 */
export function isOpenEntry(entry: PlanEntry): boolean {
  return entry.status === 'pending' || entry.status === 'missed';
}

/** 供调度器使用：区间内每药的全部计划时刻（interval 只返回最近的待服）。 */
export function entriesBetween(
  meds: Med[],
  records: DoseRecord[],
  fromMs: number,
  toMs: number,
  now = Date.now()
): PlanEntry[] {
  const out: PlanEntry[] = [];
  const startKey = dateKeyOfMillis(fromMs);
  const endKey = dateKeyOfMillis(toMs);

  for (const med of meds) {
    if (!med.enabled) continue;
    if (med.plan.type === 'interval') {
      const anchor = latestTaken(med.id, records);
      const step = Math.max(1, med.plan.intervalHours) * HOUR_MS;
      let cursor = anchor
        ? anchor.actedAt + step
        : timeAt(startKey, med.plan.firstTime.hour, med.plan.firstTime.minute);
      if (cursor < fromMs) {
        const k = Math.ceil((fromMs - cursor) / step);
        cursor += k * step;
      }
      if (cursor <= toMs) {
        out.push({
          medId: med.id,
          slotKey: `iv-${cursor}`,
          dateKey: dateKeyOfMillis(cursor),
          plannedAt: cursor,
          due: cursor,
          status: cursor < now ? 'missed' : 'pending',
        });
      }
      continue;
    }

    let key = startKey;
    while (key <= endKey) {
      out.push(...projectDay(med, records, key, now));
      key = dateKeyAt(key, 1);
    }
  }

  return out
    .filter((e) => e.due >= fromMs && e.due <= toMs && isOpenEntry(e))
    .sort((a, b) => a.due - b.due);
}

/** 毫秒 → YYYY-MM-DD。 */
export function dateKeyOfMillis(millis: number): string {
  const d = new Date(millis);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
