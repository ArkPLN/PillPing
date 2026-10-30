/**
 * 普通药物（Med）的纯函数逻辑。
 * 对应 legacy Med.java：forSlot / isCourseActive / courseEnd / courseText / followupText
 * 以及 slotMask 位操作。
 */

import { formatMonthDay } from './format';
import { MAX_DOSES, type Med } from './types';

/** 对应 legacy Med.forSlot：是否在第 slot 次服用。 */
export function forSlot(med: Med, slot: number): boolean {
  if (!med.enabled || slot < 0 || slot >= MAX_DOSES) return false;
  return med.allDoses || ((med.slotMask >>> slot) & 1) === 1;
}

/** 对应 legacy Med.courseEnd；0 表示长期。 */
export function courseEnd(med: Med, now = Date.now()): number {
  if (med.courseDays <= 0) return 0;
  const start = med.courseStart > 0 ? med.courseStart : now;
  return start + med.courseDays * 86_400_000;
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

/** 对应 legacy Med.followupText。 */
export function followupText(med: Med): string {
  if (med.followupDays <= 0) return '';
  if (med.nextFollowupAt <= 0) return `每 ${med.followupDays} 天复诊`;
  return `复诊 ${formatMonthDay(med.nextFollowupAt)}`;
}

export function isSlot(med: Med, slot: number): boolean {
  if (slot < 0 || slot >= MAX_DOSES) return false;
  return ((med.slotMask >>> slot) & 1) === 1;
}

/** 对应 legacy Med.setSlot。 */
export function setSlot(med: Med, slot: number, selected: boolean): Med {
  if (slot < 0 || slot >= MAX_DOSES) return med;
  const mask = selected ? med.slotMask | (1 << slot) : med.slotMask & ~(1 << slot);
  return { ...med, slotMask: mask };
}

/** 对应 legacy Med.toggleSlot。 */
export function toggleSlot(med: Med, slot: number): Med {
  if (slot < 0 || slot >= MAX_DOSES) return med;
  return { ...med, slotMask: med.slotMask ^ (1 << slot) };
}

/** 统计某个 slot 下应服用的药物（enabled + 疗程内 + 命中 slot）。 */
export function medsForSlot(meds: Med[], slot: number, now = Date.now()): Med[] {
  return meds.filter((m) => m.enabled && isCourseActive(m, now) && forSlot(m, slot));
}

export function hasActiveMeds(meds: Med[], now = Date.now()): boolean {
  return meds.some((m) => m.enabled && isCourseActive(m, now));
}

export function activeMedCount(meds: Med[], now = Date.now()): number {
  return meds.filter((m) => m.enabled && isCourseActive(m, now)).length;
}
