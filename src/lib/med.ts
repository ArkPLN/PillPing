/**
 * 普通药物（Med）的纯函数逻辑：疗程、复诊与计划摘要。
 */

import { DAY_MS } from '../constants/time';
import { WEEKDAY_LABELS } from '../constants/plan';
import { formatMonthDay, formatTime } from './format';
import { timeAt } from './plan';
import type { Med, PlanSlot, SchedulePlan } from './types';
import { startOfToday } from '../utils/datetime';

const FOLLOWUP_HOUR = 9;

/** 对应 legacy Med.courseEnd；0 表示长期。 */
export function courseEnd(med: Med, now = Date.now()): number {
  if (med.courseDays <= 0) return 0;
  const start = med.courseStart > 0 ? med.courseStart : now;
  return start + med.courseDays * DAY_MS;
}

/** 对应 legacy Med.isCourseActive。 */
export function isCourseActive(med: Med, now = Date.now()): boolean {
  if (med.courseDays <= 0) return true;
  if (med.courseStart <= 0) return true;
  return now < courseEnd(med, now);
}

/** 对应 legacy Med.courseText。 */
export function courseText(med: Med, now = Date.now()): string {
  if (med.courseDays <= 0) return '长期服用';
  const end = courseEnd(med, now);
  if (end <= 0) return `${med.courseDays} 天`;
  if (now >= end) return '疗程已结束';
  return `疗程至 ${formatMonthDay(end - 1)}`;
}

/** 复诊文案：有疗程时为「最后一天后 N 天」，长期时从开始日起算。 */
export function followupText(med: Med): string {
  if (med.followupDays <= 0) return '';
  if (med.nextFollowupAt <= 0) return `最后一天后 ${med.followupDays} 天复诊`;
  return `复诊 ${formatMonthDay(med.nextFollowupAt)}`;
}

/**
 * 复诊目标时刻。
 * - 有疗程：最后一天服药后第 followupDays 天；
 * - 长期：从 courseStart 起第 followupDays 天。
 */
export function computeFollowupAt(med: Med, now = Date.now()): number {
  if (med.followupDays <= 0) return 0;
  const dayStart = startOfToday(now);
  const base = med.courseStart > 0 ? med.courseStart : dayStart;
  const offsetDays =
    med.courseDays > 0
      ? med.courseDays - 1 + med.followupDays
      : med.followupDays;
  return base + offsetDays * DAY_MS + FOLLOWUP_HOUR * 60 * 60 * 1000;
}

/** 计划中的全部槽位（interval 无槽位）。 */
export function planSlotsOf(plan: SchedulePlan): PlanSlot[] {
  return plan.type === 'interval' ? [] : plan.slots;
}

/** 槽位时刻文案（HH:mm）。 */
export function slotTimeText(slot: PlanSlot): string {
  const d = new Date(2026, 0, 1, slot.hour, slot.minute);
  return formatTime(d.getTime());
}

/** 计划摘要：用于药物卡片。 */
export function planSummary(med: Med): string {
  const plan = med.plan;
  if (plan.type === 'interval') {
    return `每 ${plan.intervalHours} 小时 · 每天 ${plan.dosesPerDay} 次`;
  }
  const times = plan.slots
    .slice()
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    .map((s) => `${pad2(s.hour)}:${pad2(s.minute)}`)
    .join(' · ');
  if (plan.type === 'weekly') {
    const days: string[] = [];
    for (let i = 0; i < WEEKDAY_LABELS.length; i++) {
      if ((plan.daysMask >>> i) & 1) days.push(`周${WEEKDAY_LABELS[i]}`);
    }
    return `每周${days.join('、')} ${times}`;
  }
  return `每天 ${times}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
