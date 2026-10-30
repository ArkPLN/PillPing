/**
 * 药物与剂型逻辑测试。
 * 重点验证 inferForm 的关键词优先级与 legacy Forms.java 一致。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FORM_CAPSULE,
  FORM_INJECTION,
  FORM_LIQUID,
  FORM_TABLET,
  FORM_TOPICAL,
  formIndexOf,
  inferForm,
} from '../forms.ts';
import {
  activeMedCount,
  courseEnd,
  courseText,
  followupText,
  forSlot,
  hasActiveMeds,
  isCourseActive,
  isSlot,
  medsForSlot,
  setSlot,
  toggleSlot,
} from '../med.ts';
import type { Med } from '../types.ts';

const DAY = 86_400_000;

function makeMed(over: Partial<Med> = {}): Med {
  return {
    id: 'm1',
    name: '维生素D',
    dose: '1片',
    method: '口服',
    form: FORM_TABLET,
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

describe('inferForm', () => {
  it('注射优先于其它关键词', () => {
    assert.equal(inferForm('某某注射液', '2ml', '注射'), FORM_INJECTION);
    // 名字里同时有「片」也应判为注射剂
    assert.equal(inferForm('甲片注射液', '1支', '注射'), FORM_INJECTION);
  });

  it('外用/吸入优先于胶囊', () => {
    assert.equal(inferForm('某某软膏', '', '外用'), FORM_TOPICAL);
    assert.equal(inferForm('喷雾胶囊', '', ''), FORM_TOPICAL);
  });

  it('胶囊', () => {
    assert.equal(inferForm('阿莫西林胶囊', '0.25g', '口服'), FORM_CAPSULE);
    assert.equal(inferForm('某某胶丸', '', '口服'), FORM_CAPSULE);
  });

  it('口服液', () => {
    assert.equal(inferForm('某某糖浆', '10ml', '口服'), FORM_LIQUID);
    assert.equal(inferForm('某某', '5毫升', '口服'), FORM_LIQUID);
    assert.equal(inferForm('某某溶液', '', ''), FORM_LIQUID);
  });

  it('药片', () => {
    assert.equal(inferForm('维生素C片', '1片', '口服'), FORM_TABLET);
    assert.equal(inferForm('某某颗粒', '', ''), FORM_TABLET);
  });

  it('无法判断时默认药片', () => {
    assert.equal(inferForm('某某药', '1', '口服'), FORM_TABLET);
    assert.equal(inferForm('', '', ''), FORM_TABLET);
  });

  // 注意：legacy Forms.java 用 d.contains("ml") 检查「原始」dose 字符串，
  // 而非小写化后的 all 字符串，因此 "5ML" 在 legacy 中同样不会被识别为口服液。
  // 这里刻意保持 bug-for-bug 兼容，以满足「原有功能不变」的要求。
  it('ml 仅小写被识别（与 legacy 的大小写敏感行为一致）', () => {
    assert.equal(inferForm('某某', '5ml', '口服'), FORM_LIQUID);
    assert.equal(inferForm('某某', '5mL', '口服'), FORM_TABLET);
    assert.equal(inferForm('某某', '5ML', '口服'), FORM_TABLET);
    // 毫升是中文，不受大小写影响
    assert.equal(inferForm('某某', '5毫升', '口服'), FORM_LIQUID);
  });
});

describe('formIndexOf', () => {
  it('已知值返回索引，未知值回落 0', () => {
    assert.equal(formIndexOf('药片'), 0);
    assert.equal(formIndexOf('胶囊'), 1);
    assert.equal(formIndexOf('其他'), 5);
    assert.equal(formIndexOf('不存在的剂型'), 0);
  });
});

describe('forSlot / slotMask', () => {
  it('allDoses 为 true 时任意 slot 都命中', () => {
    const m = makeMed({ allDoses: true });
    assert.equal(forSlot(m, 0), true);
    assert.equal(forSlot(m, 11), true);
  });

  it('allDoses 为 false 时按位判断', () => {
    const m = makeMed({ allDoses: false, slotMask: 0b101 });
    assert.equal(forSlot(m, 0), true);
    assert.equal(forSlot(m, 1), false);
    assert.equal(forSlot(m, 2), true);
  });

  it('停用或不合法 slot 返回 false', () => {
    assert.equal(forSlot(makeMed({ enabled: false }), 0), false);
    assert.equal(forSlot(makeMed(), -1), false);
    assert.equal(forSlot(makeMed(), 12), false);
  });

  it('setSlot / toggleSlot', () => {
    let m = makeMed({ allDoses: false, slotMask: 0 });
    m = setSlot(m, 2, true);
    assert.equal(isSlot(m, 2), true);
    m = setSlot(m, 2, false);
    assert.equal(isSlot(m, 2), false);
    m = toggleSlot(m, 3);
    assert.equal(isSlot(m, 3), true);
    m = toggleSlot(m, 3);
    assert.equal(isSlot(m, 3), false);
  });

  it('setSlot 不修改原对象', () => {
    const m = makeMed({ allDoses: false, slotMask: 0 });
    setSlot(m, 1, true);
    assert.equal(m.slotMask, 0);
  });
});

describe('疗程', () => {
  const now = new Date(2026, 0, 15, 12).getTime();

  it('courseDays=0 为长期，始终有效', () => {
    const m = makeMed({ courseDays: 0 });
    assert.equal(courseEnd(m, now), 0);
    assert.equal(isCourseActive(m, now), true);
    assert.equal(courseText(m, now), '长期服用');
  });

  it('courseEnd = start + days', () => {
    const m = makeMed({ courseDays: 7, courseStart: now });
    assert.equal(courseEnd(m, now), now + 7 * DAY);
  });

  it('未到期显示疗程至（含 -1 天，与 legacy 一致）', () => {
    const m = makeMed({ courseDays: 7, courseStart: now });
    assert.equal(isCourseActive(m, now), true);
    assert.match(courseText(m, now), /^疗程至 /);
  });

  it('到期后不再有效并显示疗程已结束', () => {
    const m = makeMed({ courseDays: 7, courseStart: now - 8 * DAY });
    assert.equal(isCourseActive(m, now), false);
    assert.equal(courseText(m, now), '疗程已结束');
  });
});

describe('复诊文案', () => {
  it('未设置返回空串', () => {
    assert.equal(followupText(makeMed({ followupDays: 0 })), '');
  });

  it('已设置但无时间', () => {
    assert.equal(followupText(makeMed({ followupDays: 14 })), '每 14 天复诊');
  });

  it('已安排时间显示日期', () => {
    const t = new Date(2026, 1, 20).getTime();
    assert.match(followupText(makeMed({ followupDays: 14, nextFollowupAt: t })), /^复诊 2月20日$/);
  });
});

describe('medsForSlot / 统计', () => {
  const now = new Date(2026, 0, 15, 12).getTime();

  it('过滤停用、疗程结束、未命中 slot 的药物', () => {
    const meds = [
      makeMed({ id: 'a' }),
      makeMed({ id: 'b', enabled: false }),
      makeMed({ id: 'c', courseDays: 3, courseStart: now - 10 * DAY }),
      makeMed({ id: 'd', allDoses: false, slotMask: 0b010 }),
    ];
    const list = medsForSlot(meds, 0, now);
    assert.deepEqual(
      list.map((m) => m.id),
      ['a']
    );
    // slot 1 时 d 命中
    assert.deepEqual(
      medsForSlot(meds, 1, now).map((m) => m.id),
      ['a', 'd']
    );
  });

  it('hasActiveMeds / activeMedCount', () => {
    const meds = [
      makeMed({ id: 'a' }),
      makeMed({ id: 'b', enabled: false }),
      makeMed({ id: 'c', courseDays: 3, courseStart: now - 10 * DAY }),
    ];
    assert.equal(hasActiveMeds(meds, now), true);
    assert.equal(activeMedCount(meds, now), 1);
    assert.equal(hasActiveMeds([], now), false);
  });
});
