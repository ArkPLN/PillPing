/**
 * 特殊用药（SpecialMed）的纯函数逻辑。
 * 对应 legacy SpecialMed.java：computeNext / computeNextAfterTaken / scheduleText
 *
 * 关键规则（与 legacy 一致）：
 * - MODE_INTERVAL：上一次实际服用时间 + N 小时
 * - MODE_DAILY：下一次到点时刻；记录服用后总是排到「明天同一时刻」，避免同日重复提醒
 */

import { formatTime } from './format';
import { SPECIAL_MODE_DAILY, SPECIAL_MODE_INTERVAL, type SpecialMed } from './types';

export const HOUR_MS = 3600_000;

/** 对应 legacy SpecialMed.effectiveAt：有推迟优先。 */
export function effectiveAt(m: SpecialMed): number {
  return m.snoozeUntil > 0 ? m.snoozeUntil : m.nextAt;
}

/**
 * 对应 legacy SpecialMed.computeNext(fromMillis)。
 * 间隔模式：from + N 小时
 * 每天固定：取当天 hour:minute；若已过则顺延到次日
 */
export function computeNext(m: SpecialMed, fromMillis: number): number {
  const from = fromMillis > 0 ? fromMillis : Date.now();

  if (m.mode === SPECIAL_MODE_INTERVAL) {
    return from + Math.max(1, m.intervalHours) * HOUR_MS;
  }

  const c = new Date(from);
  c.setHours(Math.max(0, Math.min(23, m.hour)), Math.max(0, Math.min(59, m.minute)), 0, 0);
  if (c.getTime() <= from) {
    c.setDate(c.getDate() + 1);
  }
  return c.getTime();
}

/**
 * 对应 legacy SpecialMed.computeNextAfterTaken。
 * 每天固定模式下总是 +1 天，再套用设定的时分。
 */
export function computeNextAfterTaken(m: SpecialMed, atMillis: number): number {
  const at = atMillis > 0 ? atMillis : Date.now();

  if (m.mode === SPECIAL_MODE_INTERVAL) {
    return at + Math.max(1, m.intervalHours) * HOUR_MS;
  }

  const c = new Date(at);
  c.setDate(c.getDate() + 1);
  c.setHours(Math.max(0, Math.min(23, m.hour)), Math.max(0, Math.min(59, m.minute)), 0, 0);
  return c.getTime();
}

/** 对应 legacy SpecialMed.scheduleText。 */
export function scheduleText(m: SpecialMed): string {
  if (m.mode === SPECIAL_MODE_INTERVAL) {
    return `每 ${m.intervalHours} 小时`;
  }
  const hh = m.hour < 10 ? `0${m.hour}` : String(m.hour);
  const mm = m.minute < 10 ? `0${m.minute}` : String(m.minute);
  return `每天 ${hh}:${mm}`;
}

export { formatTime };
