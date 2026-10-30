import { useStore } from '@/store/useStore';
import { allResolved, effectiveTime, isStarted, nextPending } from '@/lib/cycle';
import { todayKey } from '@/lib/format';

/**
 * 是否需要开始新的一天。对应 legacy MainActivity.shouldStartNewDay()。
 *
 * - 无 cycle / 未开始 → true
 * - 全部完成：只有当 startDate 不是今天时才是新的一天
 * - 未完成但已跨天：若当前时间已过最后一次计划 6 小时，也视为新的一天
 */
export function shouldStartNewDay(cycle = useStore.getState().cycle, now = Date.now()): boolean {
  if (!cycle || !isStarted(cycle)) return true;

  const today = todayKey();
  if (allResolved(cycle)) {
    return today !== cycle.startDate;
  }
  if (today !== cycle.startDate) {
    const last = cycle.count > 0 ? cycle.planned[cycle.count - 1] : cycle.firstAt;
    return now > last + 6 * 3600_000;
  }
  return false;
}

/** 当前待服次数的索引（无则 -1）。 */
export function currentNext(cycle = useStore.getState().cycle): number {
  if (!cycle || !isStarted(cycle)) return -1;
  return nextPending(cycle);
}

/** 当前待服次数的到点时间（无则 0）。 */
export function currentDue(cycle = useStore.getState().cycle): number {
  const i = currentNext(cycle);
  return i < 0 ? 0 : effectiveTime(cycle!, i);
}
