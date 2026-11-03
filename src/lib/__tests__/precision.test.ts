/**
 * 时间精度测试：内部时间戳保留秒级精度，不做分钟取整。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HOUR_MS } from '../../constants/time.ts';
import { projectDay } from '../plan.ts';
import { DOSE_TAKEN, type DoseRecord, type Med } from '../types.ts';

function at(hour: number, minute: number, second = 0): number {
  return new Date(2026, 0, 15, hour, minute, second, 0).getTime();
}

function intervalMed(): Med {
  return {
    id: 'm',
    name: '药',
    doseQty: '1',
    doseUnit: '片',
    method: '口服',
    form: '片剂',
    note: '',
    enabled: true,
    plan: { type: 'interval', intervalHours: 5, dosesPerDay: 3, firstTime: { hour: 8, minute: 0 } },
    color: 0,
    courseDays: 0,
    courseStart: 0,
    followupDays: 0,
    nextFollowupAt: 0,
  };
}

describe('秒级精度', () => {
  it('链式派生保留秒分量（8:00:30 + 5h = 13:00:30）', () => {
    const rec: DoseRecord = {
      medId: 'm',
      slotKey: 'iv-' + at(8, 0, 30),
      dateKey: '2026-01-15',
      plannedAt: at(8, 0, 30),
      status: DOSE_TAKEN,
      actedAt: at(8, 0, 30),
      snoozeUntil: 0,
    };
    const entries = projectDay(intervalMed(), [rec], '2026-01-15', at(9, 0));
    const pending = entries.filter((e) => e.status !== 'taken');
    assert.equal(pending[0].plannedAt, at(13, 0, 30));
    assert.equal(pending[0].plannedAt, at(8, 0, 30) + 5 * HOUR_MS);
  });

  it('实际服用时刻带秒时，锚点精确到秒', () => {
    const rec: DoseRecord = {
      medId: 'm',
      slotKey: 'iv-' + at(9, 15, 42),
      dateKey: '2026-01-15',
      plannedAt: at(9, 15, 42),
      status: DOSE_TAKEN,
      actedAt: at(9, 15, 42),
      snoozeUntil: 0,
    };
    const entries = projectDay(intervalMed(), [rec], '2026-01-15', at(10, 0));
    const pending = entries.filter((e) => e.status !== 'taken');
    assert.equal(pending[0].plannedAt, at(9, 15, 42) + 5 * HOUR_MS);
  });
});
