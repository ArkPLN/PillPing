/**
 * 特殊用药三形态测试。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeNext,
  computeNextAfterTaken,
  modeText,
  recordKeyFor,
  scheduleText,
} from '../specialmed.ts';
import {
  DOSE_TAKEN,
  SPECIAL_MODE_DATES,
  SPECIAL_MODE_ONCE,
  SPECIAL_MODE_WEEKLY,
  type SpecialMed,
} from '../types.ts';

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 0, day, hour, minute, 0, 0).getTime();

function special(over: Partial<SpecialMed> = {}): SpecialMed {
  return {
    id: 's1',
    code: 0,
    name: '特殊药',
    doseQty: '1',
    doseUnit: '片',
    method: '口服',
    form: '片剂',
    note: '',
    enabled: true,
    mode: SPECIAL_MODE_ONCE,
    onceDate: '2026-01-15',
    times: ['10:00', '16:00'],
    dates: [],
    weeklyTarget: 3,
    weeklyStepDays: 2,
    records: [],
    nextAt: 0,
    lastAt: 0,
    snoozeUntil: 0,
    ...over,
  };
}

describe('once', () => {
  it('取当日下一个时刻', () => {
    assert.equal(computeNext(special(), at(15, 9)), at(15, 10));
    assert.equal(computeNext(special(), at(15, 11)), at(15, 16));
  });

  it('当日时刻用尽后无后续', () => {
    assert.equal(computeNext(special(), at(15, 17)), 0);
  });

  it('记录后推进到下一个时刻', () => {
    assert.equal(computeNextAfterTaken(special(), at(15, 10, 30)), at(15, 16));
  });
});

describe('dates', () => {
  it('按日期与时刻升序推进', () => {
    const m = special({
      mode: SPECIAL_MODE_DATES,
      dates: ['2026-01-16', '2026-01-18'],
      times: ['10:00'],
    });
    assert.equal(computeNext(m, at(15, 9)), at(16, 10));
    assert.equal(computeNext(m, at(16, 11)), at(18, 10));
    assert.equal(computeNext(m, at(19, 0)), 0);
  });
});

describe('weekly-count', () => {
  it('无记录时按今天/间隔推进', () => {
    const m = special({
      mode: SPECIAL_MODE_WEEKLY,
      times: ['09:00'],
      weeklyTarget: 3,
      weeklyStepDays: 2,
    });
    assert.equal(computeNext(m, at(15, 8)), at(15, 9));
    assert.equal(computeNext(m, at(15, 10)), at(17, 9));
  });

  it('本周达标后顺延到下周一', () => {
    const m = special({
      mode: SPECIAL_MODE_WEEKLY,
      times: ['09:00'],
      weeklyTarget: 2,
      records: [
        { key: 'a', due: at(13, 9), status: DOSE_TAKEN, actedAt: at(13, 9), snoozeUntil: 0 },
        { key: 'b', due: at(14, 9), status: DOSE_TAKEN, actedAt: at(14, 9), snoozeUntil: 0 },
      ],
    });
    const next = computeNext(m, at(15, 10));
    const d = new Date(next);
    assert.equal(d.getDay(), 1);
    assert.equal(d.getHours(), 9);
  });
});

describe('文案与记录 key', () => {
  it('modeText', () => {
    assert.equal(modeText(special()), '一次性');
    assert.equal(modeText(special({ mode: SPECIAL_MODE_WEEKLY, weeklyTarget: 3 })), '每周 3 次');
    assert.equal(modeText(special({ mode: SPECIAL_MODE_DATES })), '指定日期');
  });

  it('scheduleText 非空', () => {
    assert.ok(scheduleText(special()).length > 0);
    assert.ok(scheduleText(special({ mode: SPECIAL_MODE_WEEKLY })).includes('每周'));
  });

  it('recordKeyFor 含日期与时刻', () => {
    assert.equal(recordKeyFor(at(15, 10)), '2026-01-15-10:00');
  });
});
