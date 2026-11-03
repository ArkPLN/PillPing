/**
 * 从 store 组装 SchedulerInput。
 */

import { useStore } from '@/store/useStore';
import { isCourseActive } from '@/lib/med';
import type { DoseRecord, Med, SpecialMed } from '@/lib/types';

export type SchedulerInput = {
  remindersEnabled: boolean;
  meds: Med[];
  records: DoseRecord[];
  specials: SpecialMed[];
};

export function buildSchedulerInput(): SchedulerInput {
  const s = useStore.getState();
  const now = Date.now();
  return {
    remindersEnabled: s.remindersEnabled,
    meds: s.meds.filter((m) => m.enabled && isCourseActive(m, now)),
    records: s.records,
    specials: s.specials,
  };
}
