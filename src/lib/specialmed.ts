/**
 * 特殊用药（SpecialMed）的纯函数逻辑。
 *
 * 三种非常规形态：
 * - once：单个日期 + 当日多个时刻；
 * - weekly-count：每周 N 次，按固定间隔天数推进，周一归零；
 * - dates：单个或多个指定日期 + 共用时刻列表。
 */

import { DAY_MS } from '../constants/time';
import { dateKeyOfMillis, parseTimeText, timeAt } from './plan';
import { formatMonthDay, formatTime } from './format';
import { effectiveDue } from './effective';
import {
  DOSE_PENDING,
  DOSE_TAKEN,
  SPECIAL_MODE_DATES,
  SPECIAL_MODE_ONCE,
  SPECIAL_MODE_WEEKLY,
  type SpecialMed,
  type SpecialRecord,
} from './types';

/** 推迟优先的到点时间。 */
export function effectiveAt(m: SpecialMed): number {
  return effectiveDue(m.snoozeUntil, m.nextAt);
}

function occurrencesFor(m: SpecialMed, dateKeyString: string): number[] {
  const times = m.times.length > 0 ? m.times : ['09:00'];
  return times
    .map((t) => parseTimeText(t))
    .filter((t): t is { hour: number; minute: number } => t !== null)
    .map((t) => timeAt(dateKeyString, t.hour, t.minute))
    .sort((a, b) => a - b);
}

/** 某日期集合 × 时刻列表的全部时刻，升序。 */
function allOccurrences(m: SpecialMed): number[] {
  if (m.mode === SPECIAL_MODE_ONCE) {
    return m.onceDate ? occurrencesFor(m, m.onceDate) : [];
  }
  if (m.mode === SPECIAL_MODE_DATES) {
    return m.dates
      .slice()
      .sort()
      .flatMap((d) => occurrencesFor(m, d))
      .sort((a, b) => a - b);
  }
  return [];
}

/** 周一零点。 */
function weekStart(millis: number): number {
  const d = new Date(millis);
  const day = (d.getDay() + 6) % 7; // 0=周一
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return start.getTime();
}

/** 本周已服次数（周一起算）。 */
export function weeklyTakenCount(m: SpecialMed, atMillis: number): number {
  const start = weekStart(atMillis);
  const end = start + 7 * DAY_MS;
  let n = 0;
  for (const r of m.records) {
    if (r.status !== DOSE_TAKEN || r.actedAt <= 0) continue;
    if (r.actedAt >= start && r.actedAt < end) n += 1;
  }
  return n;
}

/** weekly-count 的首剂时刻（times[0] 或 09:00）。 */
function weeklyTimeOfDay(m: SpecialMed): { hour: number; minute: number } {
  return parseTimeText(m.times[0] ?? '09:00') ?? { hour: 9, minute: 0 };
}

/** 把某天的日期与 weekly 时刻合成时间戳。 */
function weeklyAt(dateMillis: number, m: SpecialMed): number {
  const t = weeklyTimeOfDay(m);
  const d = new Date(dateMillis);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.hour, t.minute, 0, 0).getTime();
}

/**
 * 下一次到点时刻（fromMillis 之后）。
 * 返回 0 表示没有后续。
 */
export function computeNext(m: SpecialMed, fromMillis: number): number {
  const from = fromMillis > 0 ? fromMillis : Date.now();

  if (m.mode === SPECIAL_MODE_ONCE || m.mode === SPECIAL_MODE_DATES) {
    for (const at of allOccurrences(m)) {
      if (at > from) return at;
    }
    return 0;
  }

  // weekly-count
  const target = Math.max(1, m.weeklyTarget);
  if (weeklyTakenCount(m, from) >= target) {
    const nextWeek = weekStart(from) + 7 * DAY_MS;
    return weeklyAt(nextWeek, m);
  }

  if (m.lastAt > 0) {
    let cursor = weeklyAt(m.lastAt + Math.max(1, m.weeklyStepDays) * DAY_MS, m);
    while (cursor <= from) {
      cursor = weeklyAt(cursor + Math.max(1, m.weeklyStepDays) * DAY_MS, m);
    }
    return cursor;
  }

  const today = weeklyAt(from, m);
  if (today > from) return today;
  return weeklyAt(from + Math.max(1, m.weeklyStepDays) * DAY_MS, m);
}

/**
 * 记录一次实际使用后的下一次到点时刻。
 * - once / dates：下一个尚未过去的时刻；
 * - weekly-count：本周达标则下周一，否则按间隔天数推进。
 */
export function computeNextAfterTaken(m: SpecialMed, atMillis: number): number {
  const at = atMillis > 0 ? atMillis : Date.now();

  if (m.mode === SPECIAL_MODE_ONCE || m.mode === SPECIAL_MODE_DATES) {
    return computeNext(m, at);
  }

  const target = Math.max(1, m.weeklyTarget);
  if (weeklyTakenCount(m, at) >= target) {
    return weeklyAt(weekStart(at) + 7 * DAY_MS, m);
  }
  return weeklyAt(at + Math.max(1, m.weeklyStepDays) * DAY_MS, m);
}

/** 记录标识：日期 + 时刻。 */
export function recordKeyFor(due: number): string {
  return `${dateKeyOfMillis(due)}-${formatTime(due)}`;
}

/** 由一次到点时刻构造记录。 */
export function buildRecord(due: number): SpecialRecord {
  return {
    key: recordKeyFor(due),
    due,
    status: DOSE_PENDING,
    actedAt: 0,
    snoozeUntil: 0,
  };
}

/** 形态文案。 */
export function modeText(m: SpecialMed): string {
  if (m.mode === SPECIAL_MODE_ONCE) return '一次性';
  if (m.mode === SPECIAL_MODE_WEEKLY) return `每周 ${m.weeklyTarget} 次`;
  return '指定日期';
}

/** 完整节奏文案。 */
export function scheduleText(m: SpecialMed): string {
  if (m.mode === SPECIAL_MODE_ONCE) {
    const times = m.times.join('、');
    return `一次性 · ${m.onceDate ? formatMonthDay(timeAt(m.onceDate, 0, 0)) : '未选日期'} ${times}`;
  }
  if (m.mode === SPECIAL_MODE_WEEKLY) {
    return `每周 ${m.weeklyTarget} 次 · 每 ${m.weeklyStepDays} 天推进`;
  }
  const dates = m.dates.map((d) => formatMonthDay(timeAt(d, 0, 0))).join('、');
  return `指定日期 · ${dates || '未选日期'} ${m.times.join('、')}`;
}

/** 记录列表（已完成记录 + 下一次），按时间倒序展示用。 */
export function recordsForDisplay(m: SpecialMed): SpecialRecord[] {
  return m.records.slice().sort((a, b) => b.due - a.due);
}
