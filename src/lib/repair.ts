/**
 * 反序列化后的数据自愈：
 *
 * 1. courseDays > 0 但 courseStart <= 0 的药物，用今天零点补齐；
 * 2. 特殊用药 nextAt <= 0 且启用时按当前时间重算；
 * 3. 丢弃找不到所属药物的孤儿剂量记录，并补齐特殊用药的记录/日期/时刻字段。
 *
 * 纯函数，不含 React/存储依赖。
 */

import { computeNext } from './specialmed';
import type { DoseRecord, Med, SpecialMed } from './types';

import { startOfToday } from '../utils/datetime';

export type RepairableState = {
  meds: Med[];
  records: DoseRecord[];
  specials: SpecialMed[];
};

export function repairState<T extends RepairableState>(s: T, now = Date.now()): T {
  const todayStart = startOfToday(now);

  const meds = s.meds.map((m) =>
    m.courseDays > 0 && m.courseStart <= 0 ? { ...m, courseStart: todayStart } : m
  );

  const medIds = new Set(meds.map((m) => m.id));
  const records = s.records.filter((r) => medIds.has(r.medId));

  const specials = s.specials.map((m) => {
    const normalized: SpecialMed = {
      ...m,
      times: Array.isArray(m.times) && m.times.length > 0 ? m.times : ['09:00'],
      dates: Array.isArray(m.dates) ? m.dates : [],
      records: Array.isArray(m.records) ? m.records : [],
      weeklyTarget: m.weeklyTarget > 0 ? m.weeklyTarget : 3,
      weeklyStepDays: m.weeklyStepDays > 0 ? m.weeklyStepDays : 2,
      onceDate: m.onceDate ?? '',
    };
    if (!normalized.enabled) return normalized;
    return normalized.nextAt > 0 ? normalized : { ...normalized, nextAt: computeNext(normalized, now) };
  });

  return { ...s, meds, records, specials };
}
