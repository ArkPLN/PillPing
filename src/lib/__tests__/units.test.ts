/**
 * 剂量单位与数量解析测试。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_UNIT, UNITS, formatDose, parseAmount } from '../units.ts';

describe('剂量单位', () => {
  it('默认单位为片', () => {
    assert.equal(DEFAULT_UNIT, '片');
  });

  it('覆盖喷、涂等给药途径', () => {
    assert.ok(UNITS.includes('喷'));
    assert.ok(UNITS.includes('涂'));
    assert.ok(UNITS.includes('单位'));
    assert.ok(UNITS.includes('IU'));
  });
});

describe('parseAmount', () => {
  it('接受阿拉伯数字与小数', () => {
    assert.equal(parseAmount('1'), 1);
    assert.equal(parseAmount('1.5'), 1.5);
  });

  it('接受中文数字写法', () => {
    assert.equal(parseAmount('半'), 0.5);
    assert.equal(parseAmount('两'), 2);
    assert.equal(parseAmount('十二'), 12);
    assert.equal(parseAmount('二十'), 20);
  });

  it('无法解析返回 null', () => {
    assert.equal(parseAmount(''), null);
    assert.equal(parseAmount('abc'), null);
  });

  it('formatDose 组合数量与单位', () => {
    assert.equal(formatDose('半', '片'), '半片');
    assert.equal(formatDose('', '片'), '');
  });
});
