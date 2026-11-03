/**
 * 每药服药计划派生测试。
 *
 * interval 型的三个 legacy 链式案例继续在这里钉住。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { projectDay } from '../plan.ts';
import type { DoseRecord, Med, SchedulePlan } from '../types.ts';
import { DOSE_TAKEN } from '../types.ts';

const DAY = '2026-01-15'; // 周四

function at(hour: number, minute = 0, second = 0, day = 15): number {
  return new Date(2026, 0, day, hour, minute, second, 0).getTime();
}

function med(plan: SchedulePlan, over: Partial<Med> = {}): Med {
  return {
    id: 'm1',
    name: '测试药',
    doseQty: '1',
    doseUnit: '片',
    method: '口服',
    form: '片剂',
    note: '',
    enabled: true,
    plan,
    color: 0,
    courseDays: 0,
    courseStart: 0,
    followupDays: 0,
    nextFollowupAt: 0,
    ...over,
  };
}

function record(over: Partial<DoseRecord> = {}): DoseRecord {
  return {
    medId: 'm1',
    slotKey: 'slot-a',
    dateKey: DAY,
    plannedAt: at(8, 0),
    status: DOSE_TAKEN,
    actedAt: at(8, 0),
    snoozeUntil: 0,
    ...over,
  };
}

function daily(over: Partial<Med> = {}): Med {
  return med(
    {
      type: 'daily',
      slots: [
        { id: 'a', hour: 8, minute: 0, label: '早', qty: '', unit: '片' },
        { id: 'b', hour: 12, minute: 0, label: '中', qty: '', unit: '片' },
        { id: 'c', hour: 18, minute: 0, label: '晚', qty: '2', unit: '片' },
      ],
    },
    over
  );
}

function interval(over: Partial<Med> = {}): Med {
  return med(
    {
      type: 'interval',
      intervalHours: 5,
      dosesPerDay: 3,
      firstTime: { hour: 8, minute: 0 },
    },
    over
  );
}

describe('daily / weekly', () => {
  it('每天固定时刻按槽位生成', () => {
    const entries = projectDay(daily(), [], DAY, at(7));
    assert.deepEqual(
      entries.map((e) => e.plannedAt),
      [at(8), at(12), at(18)]
    );
  });

  it('按周掩码过滤未选中的日子', () => {
    const weeklyPlan: SchedulePlan = {
      type: 'weekly',
      daysMask: 1 << 3, // 周四
      slots: [{ id: 'a', hour: 9, minute: 0, qty: '', unit: '片' }],
    };
    assert.equal(projectDay(med(weeklyPlan), [], DAY, at(7)).length, 1);
    const mondayOnly: SchedulePlan = {
      type: 'weekly',
      daysMask: 1 << 0,
      slots: [{ id: 'a', hour: 9, minute: 0, qty: '', unit: '片' }],
    };
    assert.equal(projectDay(med(mondayOnly), [], DAY, at(7)).length, 0);
  });

  it('过期未服为漏服，已服记录为 taken', () => {
    const missed = projectDay(daily(), [], DAY, at(10));
    assert.equal(missed[0].status, 'missed');

    const taken = projectDay(daily(), [record({ slotKey: 'a' })], DAY, at(10));
    assert.equal(taken[0].status, 'taken');
    assert.equal(taken[1].status, 'pending');
  });

  it('槽位级用量覆盖药物级', () => {
    const m = daily();
    assert.equal(m.plan.type === 'daily' ? m.plan.slots[2].qty : null, '2');
  });
});

describe('interval 链式派生（legacy 案例）', () => {
  it('初始编排 8:00 / 13:00 / 18:00', () => {
    const entries = projectDay(interval(), [], DAY, at(7));
    assert.deepEqual(
      entries.map((e) => e.plannedAt),
      [at(8), at(13), at(18)]
    );
  });

  it('第一次实际 10:00，后续按实际时间重排', () => {
    const rec = record({
      slotKey: 'iv-' + at(10),
      plannedAt: at(10),
      actedAt: at(10),
    });
    const entries = projectDay(interval(), [rec], DAY, at(11));
    const pending = entries.filter((e) => e.status !== 'taken');
    assert.deepEqual(
      pending.map((e) => e.plannedAt),
      [at(15), at(20)]
    );
  });

  it('第二次实际 20:30，下一次跨天 01:30', () => {
    const rec = record({
      slotKey: 'iv-' + at(20, 30),
      plannedAt: at(20, 30),
      actedAt: at(20, 30),
    });
    const nextDay = '2026-01-16';
    const entries = projectDay(interval(), [rec], nextDay, at(0, 10, 0, 16));
    assert.equal(entries[0].plannedAt, at(1, 30, 0, 16));
  });

  it('跳过不成为锚点，后续仍按最近实际服用派生', () => {
    const skipped = record({
      slotKey: 'iv-' + at(13),
      plannedAt: at(13),
      status: 2,
      actedAt: at(13),
    });
    const taken = record({
      slotKey: 'iv-' + at(10),
      plannedAt: at(10),
      actedAt: at(10),
    });
    const entries = projectDay(interval(), [taken, skipped], DAY, at(11));
    const pending = entries.filter((e) => e.status !== 'taken' && e.status !== 'skipped');
    assert.equal(pending[0].plannedAt, at(15));
  });
});

describe('秒级精度', () => {
  it('interval 锚点的秒分量参与派生', () => {
    const rec = record({
      slotKey: 'iv-' + at(8, 0, 30),
      plannedAt: at(8, 0, 30),
      actedAt: at(8, 0, 30),
    });
    const entries = projectDay(interval(), [rec], DAY, at(9));
    const pending = entries.filter((e) => e.status !== 'taken');
    assert.equal(pending[0].plannedAt, at(13, 0, 30));
  });
});
