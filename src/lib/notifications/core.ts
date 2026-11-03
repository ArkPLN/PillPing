/**
 * 通知排定的纯逻辑：identifier 与窗口筛选。
 * 不依赖 expo / react-native，便于单元测试。
 */

import { entriesBetween, type PlanEntry } from '../plan';
import type { DoseRecord, Med } from '../types';

export const DOSE_PREFIX = 'dose-';
export const SPECIAL_PREFIX = 'special-';
export const FOLLOWUP_PREFIX = 'followup-';

export function doseIdentifier(medId: string, slotKey: string, dateKey: string): string {
  return `${DOSE_PREFIX}${medId}-${slotKey}-${dateKey}`;
}

export function specialIdentifier(id: string, recordKey: string): string {
  return `${SPECIAL_PREFIX}${id}-${recordKey}`;
}

export function followupIdentifier(medId: string): string {
  return `${FOLLOWUP_PREFIX}${medId}`;
}

/** 未来窗口内需要排定的普通药剂量。 */
export function selectWindowEntries(
  meds: Med[],
  records: DoseRecord[],
  now: number,
  windowMs: number
): PlanEntry[] {
  return entriesBetween(meds, records, now, now + windowMs, now);
}
