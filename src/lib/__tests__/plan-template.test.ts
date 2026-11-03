/**
 * 默认计划模板测试。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clonePlanWithNewIds, createTemplatePlan } from '../plan-template.ts';

describe('默认模板', () => {
  it('每日三次饭后为 08:00 / 12:00 / 18:00', () => {
    const plan = createTemplatePlan(3, 'after');
    assert.deepEqual(
      plan.slots.map((s) => [s.hour, s.minute]),
      [
        [8, 0],
        [12, 0],
        [18, 0],
      ]
    );
  });

  it('每日三次饭前提前 30 分钟', () => {
    const plan = createTemplatePlan(3, 'before');
    assert.deepEqual(
      plan.slots.map((s) => [s.hour, s.minute]),
      [
        [7, 30],
        [11, 30],
        [17, 30],
      ]
    );
  });

  it('每日两次饭后为 08:00 / 18:00', () => {
    const plan = createTemplatePlan(2, 'after');
    assert.deepEqual(
      plan.slots.map((s) => [s.hour, s.minute]),
      [
        [8, 0],
        [18, 0],
      ]
    );
  });

  it('复制模板会生成新的槽位 id', () => {
    const plan = createTemplatePlan(2, 'after');
    const ids = new Set(plan.slots.map((s) => s.id));
    const clone = clonePlanWithNewIds(plan);
    assert.equal(clone.type, 'daily');
    if (clone.type === 'daily') {
      assert.notEqual(clone.slots[0].id, plan.slots[0].id);
      assert.equal(ids.has(clone.slots[0].id), false);
    }
  });
});
