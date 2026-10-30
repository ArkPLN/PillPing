/**
 * 特殊用药排程测试。
 * 重点：每天固定模式在「记录服用后」必须排到明天同一时刻。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDuration, formatDurationShort, dayLabel, weekday } from '../format.ts';
import {
  computeNext,
  computeNextAfterTaken,
  effectiveAt,
  scheduleText,
} from '../specialmed.ts';
import { SPECIAL_MODE_DAILY, SPECIAL_MODE_INTERVAL, type SpecialMed } from '../types.ts';

const H = 3600_000;

function makeSpecial(over: Partial<SpecialMed> = {}): SpecialMed {
  return {
    id: 's1',
    code: 0,
    name: '某药',
    dose: '1片',
    method: '口服',
    form: '药片',
    note: '',
    enabled: true,
    mode: SPECIAL_MODE_INTERVAL,
    intervalHours: 8,
    hour: 21,
    minute: 0,
    nextAt: 0,
    lastAt: 0,
    snoozeUntil: 0,
    ...over,
  };
}

const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0, 0).getTime();

describe('间隔模式', () => {
  it('computeNext = from + N 小时', () => {
    const m = makeSpecial({ intervalHours: 8 });
    assert.equal(computeNext(m, at(10)), at(10) + 8 * H);
  });

  it('computeNextAfterTaken = 实际服用时间 + N 小时', () => {
    const m = makeSpecial({ intervalHours: 12 });
    assert.equal(computeNextAfterTaken(m, at(14, 30)), at(14, 30) + 12 * H);
  });

  it('间隔小于 1 小时按 1 小时算', () => {
    const m = makeSpecial({ intervalHours: 0 });
    assert.equal(computeNext(m, at(10)), at(10) + 1 * H);
  });
});

describe('每天固定时间模式', () => {
  it('当天未到点 → 取当天', () => {
    const m = makeSpecial({ mode: SPECIAL_MODE_DAILY, hour: 21, minute: 0 });
    assert.equal(computeNext(m, at(10)), at(21));
  });

  it('当天已过点 → 顺延到次日', () => {
    const m = makeSpecial({ mode: SPECIAL_MODE_DAILY, hour: 21, minute: 0 });
    assert.equal(computeNext(m, at(22)), at(21) + 24 * H);
  });

  it('恰好等于该时刻 → 顺延到次日（<= 判断）', () => {
    const m = makeSpecial({ mode: SPECIAL_MODE_DAILY, hour: 21, minute: 0 });
    assert.equal(computeNext(m, at(21)), at(21) + 24 * H);
  });

  it('记录服用后总是排到明天同一时刻', () => {
    const m = makeSpecial({ mode: SPECIAL_MODE_DAILY, hour: 21, minute: 0 });
    // 21:05 才服用，下一次仍是明天 21:00，不是今天
    assert.equal(computeNextAfterTaken(m, at(21, 5)), at(21) + 24 * H);
    // 提前服用同理
    assert.equal(computeNextAfterTaken(m, at(19)), at(21) + 24 * H);
  });

  it('自定义时分', () => {
    const m = makeSpecial({ mode: SPECIAL_MODE_DAILY, hour: 7, minute: 30 });
    assert.equal(computeNext(m, at(6)), at(7, 30));
  });
});

describe('scheduleText', () => {
  it('间隔模式', () => {
    assert.equal(scheduleText(makeSpecial({ intervalHours: 8 })), '每 8 小时');
  });

  it('每天固定模式补零', () => {
    assert.equal(
      scheduleText(makeSpecial({ mode: SPECIAL_MODE_DAILY, hour: 7, minute: 5 })),
      '每天 07:05'
    );
    assert.equal(
      scheduleText(makeSpecial({ mode: SPECIAL_MODE_DAILY, hour: 21, minute: 0 })),
      '每天 21:00'
    );
  });
});

describe('effectiveAt', () => {
  it('有推迟优先返回推迟时间', () => {
    const m = makeSpecial({ nextAt: at(10), snoozeUntil: at(10, 10) });
    assert.equal(effectiveAt(m), at(10, 10));
    const n = makeSpecial({ nextAt: at(10), snoozeUntil: 0 });
    assert.equal(effectiveAt(n), at(10));
  });
});

describe('format', () => {
  it('formatDuration', () => {
    assert.equal(formatDuration(3 * H + 25 * 60_000), '3 小时 25 分');
    assert.equal(formatDuration(5 * 60_000 + 30_000), '5 分 30 秒');
    assert.equal(formatDuration(42_000), '42 秒');
    assert.equal(formatDuration(-1000), '0 秒');
  });

  it('formatDurationShort', () => {
    assert.equal(formatDurationShort(2 * H + 10 * 60_000), '2 小时 10 分');
    assert.equal(formatDurationShort(45 * 60_000), '45 分钟');
  });

  it('weekday 周一为周一', () => {
    // 2026-01-15 是周四
    assert.equal(weekday(at(12)), '周四');
    // 2026-01-18 是周日
    assert.equal(weekday(new Date(2026, 0, 18, 12).getTime()), '周日');
  });

  it('dayLabel 今天', () => {
    assert.equal(dayLabel(Date.now()), '今天');
  });
});
