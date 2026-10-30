import {
  DOSE_PENDING,
  DOSE_SKIPPED,
  DOSE_TAKEN,
  MAX_DOSES,
  type Cycle,
  type DoseStatus,
} from './types';

export const HOUR_MS = 3600_000;
export const DAY_MS = 86_400_000;

/** 对应 legacy Cycle.clamp。 */
export function clampCount(n: number): number {
  return Math.max(1, Math.min(MAX_DOSES, n));
}

/** 新建一个空 Cycle（全部待服用）。对应 legacy Cycle(int n)。 */
export function createCycle(n: number): Cycle {
  const count = clampCount(n);
  return {
    startDate: '',
    firstAt: 0,
    count,
    planned: new Array(count).fill(0),
    status: new Array<DoseStatus>(count).fill(DOSE_PENDING),
    actedAt: new Array(count).fill(0),
    snoozeUntil: new Array(count).fill(0),
  };
}

export function isStarted(c: Cycle | null | undefined): c is Cycle {
  return !!c && c.firstAt > 0;
}

/** 对应 legacy Cycle.nextPending。 */
export function nextPending(c: Cycle): number {
  for (let i = 0; i < c.count; i++) {
    if (c.status[i] === DOSE_PENDING) return i;
  }
  return -1;
}

/** 对应 legacy Cycle.allResolved。 */
export function allResolved(c: Cycle): boolean {
  return isStarted(c) && nextPending(c) < 0;
}

export function takenCount(c: Cycle): number {
  let n = 0;
  for (let i = 0; i < c.count; i++) if (c.status[i] === DOSE_TAKEN) n++;
  return n;
}

export function skippedCount(c: Cycle): number {
  let n = 0;
  for (let i = 0; i < c.count; i++) if (c.status[i] === DOSE_SKIPPED) n++;
  return n;
}

/** 对应 legacy Cycle.lastTakenIndex。 */
export function lastTakenIndex(c: Cycle): number {
  for (let i = c.count - 1; i >= 0; i--) {
    if (c.status[i] === DOSE_TAKEN) return i;
  }
  return -1;
}

/** 对应 legacy Cycle.effectiveTime：有推迟则以推迟时间为准。 */
export function effectiveTime(c: Cycle, i: number): number {
  if (i < 0 || i >= c.count) return 0;
  if (c.snoozeUntil[i] > 0) return c.snoozeUntil[i];
  return c.planned[i];
}

/**
 * 对应 legacy Cycle.projectPendingFromLastTaken。
 *
 * 核心规则：下一次 = 最近一次「实际服用时间」+ 间隔，
 * 而不是「第一次计划时间 + N × 间隔」。
 */
export function projectPendingFromLastTaken(c: Cycle, intervalHours: number): Cycle {
  // legacy 只在已开始的 cycle 上调用本函数（Store.load / setInterval / setDoseCount
  // 都有 isStarted() 前置判断）。这里显式守卫：未开始（firstAt=0）时不应重排，
  // 否则会算出 j*step 这类无意义的绝对时间。
  if (!isStarted(c)) return c;

  const next: Cycle = {
    ...c,
    planned: [...c.planned],
    snoozeUntil: [...c.snoozeUntil],
  };

  let anchor = lastTakenIndex(next);
  let base: number;
  if (anchor >= 0) {
    base = next.actedAt[anchor] > 0 ? next.actedAt[anchor] : next.planned[anchor];
  } else {
    anchor = 0;
    base = next.firstAt;
  }

  const step = Math.max(1, intervalHours) * HOUR_MS;
  for (let j = anchor + 1; j < next.count; j++) {
    if (next.status[j] !== DOSE_PENDING) continue;
    next.planned[j] = base + (j - anchor) * step;
    next.snoozeUntil[j] = 0;
  }
  return next;
}

/**
 * 对应 legacy Cycle.rescheduleAfterTaken。
 * 记录第 index 次实际服用后，后续所有待服次数都从该实际时间重排。
 */
export function rescheduleAfterTaken(c: Cycle, index: number, intervalHours: number): Cycle {
  if (index < 0 || index >= c.count) return c;

  const next: Cycle = {
    ...c,
    planned: [...c.planned],
    snoozeUntil: [...c.snoozeUntil],
  };

  const base = next.actedAt[index] > 0 ? next.actedAt[index] : Date.now();
  const step = Math.max(1, intervalHours) * HOUR_MS;
  for (let j = index + 1; j < next.count; j++) {
    if (next.status[j] !== DOSE_PENDING) continue;
    next.planned[j] = base + (j - index) * step;
    next.snoozeUntil[j] = 0;
  }
  return next;
}

/**
 * 对应 legacy Cycle.resize。
 * 扩容时新增次数置为待服用，由 projectPendingFromLastTaken 补上计划时间。
 */
export function resizeCycle(c: Cycle, newCount: number): Cycle {
  const n = clampCount(newCount);
  if (n === c.count) return c;

  const pad = (arr: number[], value: number) => {
    const out = arr.slice(0, n);
    while (out.length < n) out.push(value);
    return out;
  };

  const status: DoseStatus[] = c.status.slice(0, n);
  while (status.length < n) status.push(DOSE_PENDING);

  return {
    ...c,
    count: n,
    planned: pad(c.planned, 0),
    status,
    actedAt: pad(c.actedAt, 0),
    snoozeUntil: pad(c.snoozeUntil, 0),
  };
}
