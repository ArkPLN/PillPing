/**
 * 从 store 组装 SchedulerInput。
 * 单独抽出，避免 response.ts / UI 各自重复实现摘要逻辑。
 */

import { useStore } from '@/store/useStore';
import { isCourseActive, medsForSlot } from '@/lib/med';
import type { SchedulerInput } from './scheduler';

function summaryForSlot(slot: number): string {
  const s = useStore.getState();
  const list = medsForSlot(s.meds, slot);
  return list.map((m) => `${m.name} ${m.dose}（${m.method}）`).join(' · ');
}

function bigTextForSlot(slot: number): string {
  const s = useStore.getState();
  const list = medsForSlot(s.meds, slot);
  if (list.length === 0) return '还没有添加药物，点开应用添加后再按时服用。';
  return list
    .map((m) => {
      let line = `• ${m.name}  ${m.dose}  ${m.method}`;
      if (m.note) line += `  · ${m.note}`;
      return line;
    })
    .join('\n');
}

export function buildSchedulerInput(): SchedulerInput {
  const s = useStore.getState();
  return {
    remindersEnabled: s.remindersEnabled,
    interval: s.interval,
    cycle: s.cycle,
    meds: s.meds.filter((m) => m.enabled && isCourseActive(m)),
    specials: s.specials,
    summaryForSlot,
    bigTextForSlot,
  };
}
