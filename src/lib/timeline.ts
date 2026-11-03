/**
 * 今日时间线聚合：把每个启用药物的当日剂量展平、排序并统计。
 */

import { isCourseActive } from './med';
import { projectDay, type PlanEntry } from './plan';
import type { DoseRecord, Med } from './types';

export type TimelineEntry = PlanEntry & {
  med: Med;
};

export type DayAggregate = {
  entries: TimelineEntry[];
  taken: number;
  total: number;
  missed: number;
};

/**
 * 聚合某天的全部剂量。排序：到点时间升序，同刻按药名稳定排序。
 * 已停用、不在疗程内的药物不参与。
 */
export function aggregateDay(
  meds: Med[],
  records: DoseRecord[],
  dateKeyString: string,
  now = Date.now()
): DayAggregate {
  const entries: TimelineEntry[] = [];

  for (const med of meds) {
    if (!isCourseActive(med, now)) continue;
    const dayEntries = projectDay(med, records, dateKeyString, now);
    for (const entry of dayEntries) entries.push({ ...entry, med });
  }

  entries.sort((a, b) => {
    if (a.due !== b.due) return a.due - b.due;
    if (a.med.name !== b.med.name) return a.med.name < b.med.name ? -1 : 1;
    return a.slotKey < b.slotKey ? -1 : a.slotKey > b.slotKey ? 1 : 0;
  });

  let taken = 0;
  let missed = 0;
  for (const e of entries) {
    if (e.status === 'taken') taken += 1;
    if (e.status === 'missed') missed += 1;
  }

  return { entries, taken, total: entries.length, missed };
}
