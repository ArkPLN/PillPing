/**
 * 通知纯逻辑测试：identifier 配对与 48h 窗口筛选。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  doseIdentifier,
  followupIdentifier,
  selectWindowEntries,
  specialIdentifier,
} from '../notifications/core.ts';
import { HOUR_MS } from '../../constants/time.ts';
import type { Med } from '../types.ts';

const now = new Date(2026, 0, 15, 7, 0, 0, 0).getTime();

function med(plan: Med['plan']): Med {
  return {
    id: 'm1',
    name: '药',
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
  };
}

describe('identifier', () => {
  it('普通药剂量含药、槽位与日期', () => {
    assert.equal(doseIdentifier('m1', 'slot-a', '2026-01-15'), 'dose-m1-slot-a-2026-01-15');
  });

  it('特殊用药含 id 与记录 key', () => {
    assert.equal(specialIdentifier('s1', '2026-01-15-10:00'), 'special-s1-2026-01-15-10:00');
  });

  it('复诊含药 id', () => {
    assert.equal(followupIdentifier('m1'), 'followup-m1');
  });
});

describe('selectWindowEntries', () => {
  it('24h 窗口只包含窗口内剂量', () => {
    const m = med({
      type: 'daily',
      slots: [
        { id: 'a', hour: 8, minute: 0, qty: '', unit: '片' },
        { id: 'b', hour: 20, minute: 0, qty: '', unit: '片' },
      ],
    });
    const entries = selectWindowEntries([m], [], now, 24 * HOUR_MS);
    assert.deepEqual(
      entries.map((e) => e.plannedAt),
      [new Date(2026, 0, 15, 8, 0).getTime(), new Date(2026, 0, 15, 20, 0).getTime()]
    );
  });

  it('48h 窗口包含次日剂量', () => {
    const m = med({
      type: 'daily',
      slots: [{ id: 'a', hour: 8, minute: 0, qty: '', unit: '片' }],
    });
    const entries = selectWindowEntries([m], [], now, 48 * HOUR_MS);
    assert.equal(entries.length, 2);
  });

  it('interval 只排下一个待服', () => {
    const m = med({
      type: 'interval',
      intervalHours: 6,
      dosesPerDay: 3,
      firstTime: { hour: 8, minute: 0 },
    });
    const entries = selectWindowEntries([m], [], now, 48 * HOUR_MS);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].plannedAt, new Date(2026, 0, 15, 8, 0).getTime());
  });
});
