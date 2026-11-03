/**
 * repairState 自愈测试。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { repairState } from '../repair.ts';
import { startOfToday } from '../../utils/datetime.ts';
import {
  SPECIAL_MODE_ONCE,
  type DoseRecord,
  type Med,
  type SpecialMed,
} from '../types.ts';

const now = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();

function med(over: Partial<Med> = {}): Med {
  return {
    id: 'm',
    name: '药',
    doseQty: '1',
    doseUnit: '片',
    method: '口服',
    form: '片剂',
    note: '',
    enabled: true,
    plan: { type: 'daily', slots: [{ id: 'a', hour: 8, minute: 0, qty: '', unit: '片' }] },
    color: 0,
    courseDays: 0,
    courseStart: 0,
    followupDays: 0,
    nextFollowupAt: 0,
    ...over,
  };
}

function special(over: Partial<SpecialMed> = {}): SpecialMed {
  return {
    id: 's',
    code: 0,
    name: '特殊药',
    doseQty: '1',
    doseUnit: '片',
    method: '口服',
    form: '片剂',
    note: '',
    enabled: true,
    mode: SPECIAL_MODE_ONCE,
    onceDate: '2026-01-16',
    times: ['10:00'],
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

describe('repairState', () => {
  it('补全缺失的 courseStart', () => {
    const result = repairState(
      { meds: [med({ courseDays: 5, courseStart: 0 })], records: [], specials: [] },
      now
    );
    assert.equal(result.meds[0].courseStart, startOfToday(now));
  });

  it('特殊用药 nextAt 为 0 时重算', () => {
    const result = repairState({ meds: [], records: [], specials: [special()] }, now);
    assert.ok(result.specials[0].nextAt > 0);
  });

  it('丢弃找不到所属药物的孤儿记录', () => {
    const orphan: DoseRecord = {
      medId: 'missing',
      slotKey: 'a',
      dateKey: '2026-01-15',
      plannedAt: now,
      status: 0,
      actedAt: 0,
      snoozeUntil: 0,
    };
    const valid: DoseRecord = { ...orphan, medId: 'm' };
    const result = repairState({ meds: [med()], records: [orphan, valid], specials: [] }, now);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].medId, 'm');
  });
});
