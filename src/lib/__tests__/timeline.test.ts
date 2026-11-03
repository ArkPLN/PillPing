/**
 * 今日时间线聚合测试。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateDay } from '../timeline.ts';
import type { DoseRecord, Med } from '../types.ts';
import { DOSE_TAKEN } from '../types.ts';

const DAY = '2026-01-15';

function at(hour: number, minute = 0): number {
  return new Date(2026, 0, 15, hour, minute, 0, 0).getTime();
}

function med(id: string, name: string, times: number[]): Med {
  return {
    id,
    name,
    doseQty: '1',
    doseUnit: '片',
    method: '口服',
    form: '片剂',
    note: '',
    enabled: true,
    plan: {
      type: 'daily',
      slots: times.map((t, i) => ({
        id: `${id}-${i}`,
        hour: new Date(t).getHours(),
        minute: new Date(t).getMinutes(),
        qty: '',
        unit: '片',
      })),
    },
    color: 0,
    courseDays: 0,
    courseStart: 0,
    followupDays: 0,
    nextFollowupAt: 0,
  };
}

describe('aggregateDay', () => {
  it('多药展平并按时间升序', () => {
    const a = med('a', '阿司匹林', [at(8), at(12)]);
    const b = med('b', '维生素D', [at(8), at(18)]);
    const agg = aggregateDay([a, b], [], DAY, at(7));
    assert.equal(agg.total, 4);
    assert.deepEqual(
      agg.entries.map((e) => e.due),
      [at(8), at(8), at(12), at(18)]
    );
  });

  it('统计已服与漏服', () => {
    const a = med('a', '阿司匹林', [at(8), at(12)]);
    const rec: DoseRecord = {
      medId: 'a',
      slotKey: 'a-0',
      dateKey: DAY,
      plannedAt: at(8),
      status: DOSE_TAKEN,
      actedAt: at(8, 5),
      snoozeUntil: 0,
    };
    const agg = aggregateDay([a], [rec], DAY, at(13));
    assert.equal(agg.taken, 1);
    assert.equal(agg.missed, 1);
    assert.equal(agg.total, 2);
  });

  it('停用药物不参与', () => {
    const a = med('a', '阿司匹林', [at(8)]);
    const agg = aggregateDay([{ ...a, enabled: false }], [], DAY, at(7));
    assert.equal(agg.total, 0);
  });
});
