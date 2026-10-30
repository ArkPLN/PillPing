/**
 * repairState 测试。对应 legacy Store.load() 的三段自愈逻辑。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createCycle } from '../cycle.ts';
import { repairState, startOfToday } from '../repair.ts';
import {
  DOSE_PENDING,
  DOSE_TAKEN,
  SPECIAL_MODE_DAILY,
  SPECIAL_MODE_INTERVAL,
  type Med,
  type SpecialMed,
} from '../types.ts';

const H = 3600_000;
const now = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();
const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0, 0).getTime();

function med(over: Partial<Med> = {}): Med {
  return {
    id: 'm',
    name: '药',
    dose: '1片',
    method: '口服',
    form: '药片',
    note: '',
    enabled: true,
    allDoses: true,
    slotMask: 0,
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

const base = { meds: [] as Med[], cycle: null, specials: [] as SpecialMed[], interval: 5 };

describe('startOfToday', () => {
  it('返回本地零点', () => {
    const d = new Date(startOfToday(now));
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
    assert.equal(d.getSeconds(), 0);
    assert.equal(d.getDate(), 15);
  });
});

describe('修复 1：疗程起点补全', () => {
  it('courseDays>0 且 courseStart=0 → 补今天零点', () => {
    const out = repairState({ ...base, meds: [med({ courseDays: 7, courseStart: 0 })] }, now);
    assert.equal(out.meds[0].courseStart, startOfToday(now));
  });

  it('courseDays=0 不补', () => {
    const out = repairState({ ...base, meds: [med({ courseDays: 0, courseStart: 0 })] }, now);
    assert.equal(out.meds[0].courseStart, 0);
  });

  it('已有 courseStart 不覆盖', () => {
    const start = at(3);
    const out = repairState({ ...base, meds: [med({ courseDays: 7, courseStart: start })] }, now);
    assert.equal(out.meds[0].courseStart, start);
  });
});

describe('修复 2：特殊用药 nextAt 重算', () => {
  it('nextAt=0 的间隔模式 → now + 间隔', () => {
    const out = repairState(
      { ...base, specials: [special({ intervalHours: 8, nextAt: 0 })] },
      now
    );
    assert.equal(out.specials[0].nextAt, now + 8 * H);
  });

  it('nextAt=0 的每天固定模式 → 当天/次日 21:00', () => {
    const out = repairState(
      { ...base, specials: [special({ mode: SPECIAL_MODE_DAILY, hour: 21, nextAt: 0 })] },
      now
    );
    assert.equal(out.specials[0].nextAt, at(21));
  });

  it('已有 nextAt 不改动', () => {
    const t = at(18);
    const out = repairState({ ...base, specials: [special({ nextAt: t })] }, now);
    assert.equal(out.specials[0].nextAt, t);
  });
});

describe('修复 3：cycle 重新投影', () => {
  it('无推迟记录 → 按链式规则重排', () => {
    const c = createCycle(3);
    c.firstAt = at(8);
    c.startDate = '2026-01-15';
    // 模拟"错误地按第一次 + N×间隔"排出的计划
    c.planned = [at(8), at(13), at(18)];
    c.status = [DOSE_TAKEN, DOSE_PENDING, DOSE_PENDING];
    c.actedAt = [at(14), 0, 0]; // 实际 14:00 才服用

    const out = repairState({ ...base, cycle: c, interval: 5 }, now);
    assert.equal(out.cycle!.planned[1], at(19), '应从 14:00 起算');
    assert.equal(out.cycle!.planned[2], at(24) + 0, '14:00 + 10h = 次日 00:00');
  });

  it('存在推迟记录 → 不重排（保护用户手动推迟）', () => {
    const c = createCycle(3);
    c.firstAt = at(8);
    c.planned = [at(8), at(13), at(18)];
    c.status = [DOSE_TAKEN, DOSE_PENDING, DOSE_PENDING];
    c.actedAt = [at(8), 0, 0];
    c.snoozeUntil = [0, at(13, 10), 0];

    const out = repairState({ ...base, cycle: c, interval: 5 }, now);
    assert.equal(out.cycle!.snoozeUntil[1], at(13, 10));
  });

  it('未开始的 cycle 不动', () => {
    const c = createCycle(3);
    const out = repairState({ ...base, cycle: c }, now);
    assert.equal(out.cycle!.firstAt, 0);
  });

  it('cycle 为 null 时不崩', () => {
    const out = repairState({ ...base, cycle: null }, now);
    assert.equal(out.cycle, null);
  });
});

describe('不修改入参', () => {
  it('返回新对象', () => {
    const state = { ...base, meds: [med({ courseDays: 7 })] };
    const before = JSON.stringify(state);
    const out = repairState(state, now);
    assert.notEqual(out, state);
    assert.equal(JSON.stringify(state), before);
  });
});
