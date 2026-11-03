/**
 * utils 工具函数测试：pad2 / clampAt / genId / startOfDay。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pad2 } from '../../utils/number.ts';
import { startOfDay, startOfToday } from '../../utils/datetime.ts';
import { clampAt } from '../../utils/timestamp.ts';
import { genId } from '../../utils/id.ts';

describe('pad2', () => {
  it('个位数补零', () => {
    assert.equal(pad2(0), '00');
    assert.equal(pad2(7), '07');
  });

  it('两位数原样返回', () => {
    assert.equal(pad2(13), '13');
    assert.equal(pad2(59), '59');
  });
});

describe('clampAt', () => {
  it('有效补登时刻不晚于当前', () => {
    const now = 1_000_000;
    assert.equal(clampAt(now - 5_000, now), now - 5_000);
    assert.equal(clampAt(now + 5_000, now), now, '未来时刻钳制到当前');
    assert.equal(clampAt(now, now), now);
  });

  it('无效时刻（0 或负数）返回当前', () => {
    const now = 1_000_000;
    assert.equal(clampAt(0, now), now);
    assert.equal(clampAt(-1, now), now);
  });
});

describe('genId', () => {
  it('格式为 时间戳-随机串', () => {
    const id = genId();
    assert.match(id, /^\d{13}-[0-9a-z]{2,8}$/);
  });

  it('连续生成的 ID 互不相同', () => {
    const ids = new Set(Array.from({ length: 50 }, () => genId()));
    assert.equal(ids.size, 50);
  });
});

describe('startOfDay / startOfToday', () => {
  it('取本地零点', () => {
    const d = new Date(2026, 0, 15, 12, 34, 56, 789);
    assert.equal(startOfDay(d), new Date(2026, 0, 15, 0, 0, 0, 0).getTime());
  });

  it('startOfToday 等于今天零点', () => {
    const now = new Date(2026, 4, 20, 18, 0, 0, 0).getTime();
    assert.equal(startOfToday(now), new Date(2026, 4, 20, 0, 0, 0, 0).getTime());
  });
});
