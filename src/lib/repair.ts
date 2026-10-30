/**
 * 反序列化后的数据自愈。对应 legacy Store.load() 里的三段修复逻辑：
 *
 * 1. courseDays > 0 但 courseStart <= 0 的药物，用今天零点补齐
 *    （legacy: for (Med m : meds) if (m.courseDays > 0 && m.courseStart <= 0L) m.courseStart = today）
 * 2. 特殊用药 nextAt <= 0 时按当前时间重算
 *    （legacy: for (SpecialMed m : specials) if (m.nextAt <= 0L) m.nextAt = m.computeNext(now)）
 * 3. 旧/损坏的 cycle（曾按「第一次 + N×间隔」排错）若无推迟记录，按链式规则重新投影
 *    （legacy: if (!hasSnooze) s.cycle.projectPendingFromLastTaken(s.interval)）
 *
 * 抽成纯函数以便单测，不含任何 React/存储依赖。
 */

import { isStarted, projectPendingFromLastTaken } from './cycle';
import { computeNext } from './specialmed';
import { DOSE_PENDING, type Cycle, type Med, type SpecialMed } from './types';

export type RepairableState = {
  meds: Med[];
  cycle: Cycle | null;
  specials: SpecialMed[];
  interval: number;
};

/** 今天零点的时间戳（本地时区）。 */
export function startOfToday(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function repairState<T extends RepairableState>(s: T, now = Date.now()): T {
  const todayStart = startOfToday(now);

  const meds = s.meds.map((m) =>
    m.courseDays > 0 && m.courseStart <= 0 ? { ...m, courseStart: todayStart } : m
  );

  const specials = s.specials.map((m) =>
    m.nextAt > 0 ? m : { ...m, nextAt: computeNext(m, now) }
  );

  let cycle = s.cycle;
  if (cycle && isStarted(cycle)) {
    const hasSnooze = cycle.status.some(
      (st, i) => st === DOSE_PENDING && cycle!.snoozeUntil[i] > 0
    );
    if (!hasSnooze) cycle = projectPendingFromLastTaken(cycle, s.interval);
  }

  return { ...s, meds, specials, cycle };
}
