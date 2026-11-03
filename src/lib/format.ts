/**
 * 时间格式化。对应 legacy Fmt.java，输出文案逐字一致。
 *
 * 用 JS 原生 Date 替代 java.time；本地时区与 legacy 的
 * ZoneId.systemDefault() 语义相同。
 */

import { DAY_MS } from '../constants/time';
import { pad2 } from '../utils/number';
import { startOfDay } from '../utils/datetime';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 对应 legacy Fmt.time：HH:mm */
export function formatTime(millis: number): string {
  const d = new Date(millis);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 对应 legacy Fmt.monthDay：M月d日 */
export function formatMonthDay(millis: number): string {
  const d = new Date(millis);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 对应 legacy Fmt.full：M月d日 HH:mm */
export function formatFull(millis: number): string {
  return `${formatMonthDay(millis)} ${formatTime(millis)}`;
}

/** 对应 legacy Fmt.dateKey：YYYY-MM-DD */
export function dateKey(millis: number): string {
  const d = new Date(millis);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 对应 legacy Fmt.todayKey。 */
export function todayKey(): string {
  return dateKey(Date.now());
}

/** 对应 legacy Fmt.dayLabel：今天 / 明天 / 昨天 / M月d日 */
export function dayLabel(millis: number): string {
  const d = new Date(millis);
  const today = new Date();
  const diffDays = Math.round((startOfDay(d) - startOfDay(today)) / DAY_MS);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === -1) return '昨天';
  return formatMonthDay(millis);
}

/** 对应 legacy Fmt.weekday。 */
export function weekday(millis: number): string {
  // getDay(): 0=周日 … 6=周六；legacy 用 getDayOfWeek().getValue()-1（周一=0）
  const idx = (new Date(millis).getDay() + 6) % 7;
  return WEEKDAYS[Math.max(0, Math.min(6, idx))];
}

/** 对应 legacy Fmt.dateKeyToCn：把 YYYY-MM-DD 转成 M月d日。 */
export function dateKeyToCn(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = new Date(year, month - 1, day).getTime();
  if (Number.isNaN(ms)) return key;
  return formatMonthDay(ms);
}

/** 对应 legacy Fmt.duration：X 小时 Y 分 / X 分 Y 秒 / X 秒 */
export function formatDuration(millis: number): string {
  const totalSec = Math.max(0, Math.floor(millis / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}

/** 对应 legacy Fmt.durationShort：X 小时 Y 分 / X 分钟 */
export function formatDurationShort(millis: number): string {
  const totalMin = Math.max(0, Math.floor(millis / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分钟`;
}
