/**
 * 药物逻辑测试：剂型推断、疗程、复诊与计划摘要。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inferForm } from '../forms.ts';
import {
  computeFollowupAt,
  courseEnd,
  courseText,
  isCourseActive,
  planSummary,
} from '../med.ts';
import type { Med, SchedulePlan } from '../types.ts';

const DAY = 86_400_000;

function med(plan: SchedulePlan, over: Partial<Med> = {}): Med {
  return {
    id: 'm',
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
    ...over,
  };
}

describe('inferForm', () => {
  it('按药名与用量推断剂型', () => {
    assert.equal(inferForm('胶囊', '1粒', '口服'), '胶囊');
    assert.equal(inferForm('某注射液', '1支', '注射'), '注射剂');
    assert.equal(inferForm('软膏', '1g', '外用'), '外用');
  });
});

describe('疗程', () => {
  it('courseEnd 从 courseStart 起算', () => {
    const m = med({ type: 'daily', slots: [] }, { courseDays: 5, courseStart: 0 });
    assert.equal(courseEnd(m, 1000), 1000 + 5 * DAY);
  });

  it('到期后不再启用', () => {
    const start = 0;
    const m = med(
      { type: 'daily', slots: [] },
      { courseDays: 5, courseStart: start + DAY }
    );
    assert.equal(isCourseActive(m, start), true);
    assert.equal(isCourseActive(m, start + 10 * DAY), false);
    assert.equal(courseText(m, start + 10 * DAY), '疗程已结束');
  });
});

describe('复诊', () => {
  it('有疗程：最后一天后第 N 天', () => {
    const start = new Date(2026, 0, 1).getTime();
    const m = med(
      { type: 'daily', slots: [] },
      { courseDays: 5, courseStart: start, followupDays: 1 }
    );
    const expected = start + 5 * DAY + 9 * 60 * 60 * 1000;
    assert.equal(computeFollowupAt(m), expected);
  });

  it('长期：从 courseStart 起算', () => {
    const start = new Date(2026, 0, 1).getTime();
    const m = med(
      { type: 'daily', slots: [] },
      { courseDays: 0, courseStart: start, followupDays: 7 }
    );
    assert.equal(computeFollowupAt(m), start + 7 * DAY + 9 * 60 * 60 * 1000);
  });
});

describe('planSummary', () => {
  it('每天固定', () => {
    const m = med({
      type: 'daily',
      slots: [
        { id: 'a', hour: 8, minute: 0, qty: '', unit: '片' },
        { id: 'b', hour: 20, minute: 30, qty: '', unit: '片' },
      ],
    });
    assert.equal(planSummary(m), '每天 08:00 · 20:30');
  });

  it('按周循环', () => {
    const m = med({
      type: 'weekly',
      daysMask: 1 | 4, // 周一、周三
      slots: [{ id: 'a', hour: 9, minute: 0, qty: '', unit: '片' }],
    });
    assert.equal(planSummary(m), '每周周一、周三 09:00');
  });

  it('按间隔', () => {
    const m = med({
      type: 'interval',
      intervalHours: 6,
      dosesPerDay: 3,
      firstTime: { hour: 8, minute: 0 },
    });
    assert.equal(planSummary(m), '每 6 小时 · 每天 3 次');
  });
});
