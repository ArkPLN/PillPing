/**
 * 核心排程算法测试。
 *
 * 用 legacy/README.md「核心规则 → 1. 普通服药：链式排程」里的三个案例作为基准：
 *   08:00 服用 → 第 2 次 13:00
 *   14:00 服用 → 第 3 次 19:00（而不是 18:00）
 *   20:30 服用 → 第 4 次 01:30
 *
 * 运行：node --test src/lib/__tests__/
 * （Node 原生 test runner，不引入额外依赖）
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allResolved,
  clampCount,
  createCycle,
  effectiveTime,
  nextPending,
  projectPendingFromLastTaken,
  rescheduleAfterTaken,
  resizeCycle,
  skippedCount,
  takenCount,
} from '../cycle.ts';
import { DOSE_PENDING, DOSE_SKIPPED, DOSE_TAKEN, type Cycle } from '../types.ts';

const H = 3600_000;

/** 以某天 00:00 为基准的 HH:mm 时间戳。 */
function at(hour: number, minute = 0): number {
  return new Date(2026, 0, 15, hour, minute, 0, 0).getTime();
}

/** 构造一个已开始的三次 Cycle。 */
function startedCycle(count = 3, interval = 5, firstAt = at(8)) {
  const c = createCycle(count);
  c.firstAt = firstAt;
  c.startDate = '2026-01-15';
  for (let i = 0; i < count; i++) {
    c.planned[i] = firstAt + i * interval * H;
    c.status[i] = DOSE_PENDING;
  }
  // 第一次在 firstAt 已服用
  c.status[0] = DOSE_TAKEN;
  c.actedAt[0] = firstAt;
  return c;
}

describe('clampCount', () => {
  it('限制在 1..12', () => {
    assert.equal(clampCount(0), 1);
    assert.equal(clampCount(1), 1);
    assert.equal(clampCount(12), 12);
    assert.equal(clampCount(13), 12);
    assert.equal(clampCount(-5), 1);
  });
});

describe('链式排程：README 三个案例', () => {
  it('第 1 次 08:00 服用 → 第 2 次计划 13:00', () => {
    const c = startedCycle(3, 5, at(8));
    assert.equal(c.planned[1], at(13));
    assert.equal(c.planned[2], at(18));
  });

  it('第 2 次实际 14:00 才服用 → 第 3 次改为 19:00（不是 18:00）', () => {
    let c = startedCycle(3, 5, at(8));
    // 第 2 次实际 14:00 服用
    c.status[1] = DOSE_TAKEN;
    c.actedAt[1] = at(14);
    c = rescheduleAfterTaken(c, 1, 5);
    assert.equal(c.planned[2], at(19), '应为 14:00 + 5h = 19:00');
  });

  it('第 3 次实际 20:30 服用 → 第 4 次改为次日 01:30', () => {
    let c = startedCycle(4, 5, at(8));
    c.status[1] = DOSE_TAKEN;
    c.actedAt[1] = at(14);
    c = rescheduleAfterTaken(c, 1, 5);

    c.status[2] = DOSE_TAKEN;
    c.actedAt[2] = at(20, 30);
    c = rescheduleAfterTaken(c, 2, 5);

    assert.equal(c.planned[3], at(20, 30) + 5 * H, '应为 20:30 + 5h = 次日 01:30');
  });
});

describe('projectPendingFromLastTaken', () => {
  it('从最近一次实际服用重排所有待服次数', () => {
    let c = startedCycle(4, 6, at(8)); // planned: 08,14,20,02
    c.status[1] = DOSE_TAKEN;
    c.actedAt[1] = at(15); // 实际 15:00
    c = projectPendingFromLastTaken(c, 6);

    assert.equal(c.planned[2], at(21), '15:00 + 6h');
    assert.equal(c.planned[3], at(15) + 12 * H, '15:00 + 12h');
  });

  it('未开始（firstAt=0）时不改动计划', () => {
    const c = createCycle(3);
    const out = projectPendingFromLastTaken(c, 5);
    assert.deepEqual(out.planned, [0, 0, 0]);
  });

  it('不清除已跳过次数的计划时间', () => {
    let c = startedCycle(3, 5, at(8));
    c.status[1] = DOSE_SKIPPED;
    c = projectPendingFromLastTaken(c, 5);
    assert.equal(c.planned[1], at(13), '跳过的次数保留原计划时间');
  });
});

describe('nextPending / allResolved / 计数', () => {
  it('nextPending 返回第一个待服次数', () => {
    const c = startedCycle(3, 5, at(8));
    assert.equal(nextPending(c), 1);
  });

  it('全部记录后 allResolved 为 true', () => {
    let c = startedCycle(2, 5, at(8));
    c.status[1] = DOSE_TAKEN;
    assert.equal(allResolved(c), true);
    assert.equal(nextPending(c), -1);
  });

  it('未开始时 allResolved 为 false', () => {
    assert.equal(allResolved(createCycle(3)), false);
  });

  it('takenCount / skippedCount', () => {
    const c = startedCycle(4, 5, at(8));
    c.status[1] = DOSE_SKIPPED;
    c.status[2] = DOSE_TAKEN;
    assert.equal(takenCount(c), 2);
    assert.equal(skippedCount(c), 1);
  });
});

describe('effectiveTime', () => {
  it('有 snoozeUntil 时优先返回推迟时间', () => {
    const c = startedCycle(3, 5, at(8));
    c.snoozeUntil[1] = at(13, 10);
    assert.equal(effectiveTime(c, 1), at(13, 10));
    assert.equal(effectiveTime(c, 2), at(18));
  });
});

describe('resizeCycle', () => {
  it('扩容保留已服记录并补 0', () => {
    const c = startedCycle(3, 5, at(8));
    const out = resizeCycle(c, 5);
    assert.equal(out.count, 5);
    assert.equal(out.status[0], DOSE_TAKEN);
    assert.equal(out.status[3], DOSE_PENDING);
    assert.equal(out.planned[3], 0);
    assert.equal(out.actedAt.length, 5);
  });

  it('缩容截断尾部', () => {
    const c = startedCycle(5, 5, at(8));
    const out = resizeCycle(c, 2);
    assert.equal(out.count, 2);
    assert.equal(out.planned.length, 2);
    assert.equal(out.status.length, 2);
  });

  it('相同数量返回原对象', () => {
    const c = startedCycle(3, 5, at(8));
    assert.equal(resizeCycle(c, 3), c);
  });
});

describe('不可变性', () => {
  it('projectPendingFromLastTaken 不修改入参', () => {
    const c: Cycle = startedCycle(3, 5, at(8));
    const before = JSON.stringify(c);
    projectPendingFromLastTaken(c, 8);
    assert.equal(JSON.stringify(c), before);
  });

  it('rescheduleAfterTaken 不修改入参', () => {
    const c: Cycle = startedCycle(3, 5, at(8));
    c.status[1] = DOSE_TAKEN;
    c.actedAt[1] = at(14);
    const before = JSON.stringify(c);
    rescheduleAfterTaken(c, 1, 8);
    assert.equal(JSON.stringify(c), before);
  });
});
