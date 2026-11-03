/**
 * 服药计划相关常量。所有计划派生与 UI 共同引用，保持单一来源。
 */

import { HOUR_MS, MINUTE_MS } from './time';

/** 每药每天最多时刻槽位 / 每天最多服药次数。 */
export const MAX_PLAN_SLOTS = 12;

/** 一周七天，bit0=周一 … bit6=周日。 */
export const WEEKDAY_COUNT = 7;

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 计划槽位的时机标签。 */
export const SLOT_LABELS = [
  '起床',
  '早',
  '中',
  '晚',
  '饭前',
  '饭后',
  '睡前',
] as const;

/** 全部星期都选中。 */
export const ALL_WEEKDAYS_MASK = (1 << WEEKDAY_COUNT) - 1;

/** 默认模板的基准时刻（饭后）。 */
export const TEMPLATE_BASE_TIMES: Record<1 | 2 | 3, { hour: number; minute: number }[]> = {
  1: [{ hour: 8, minute: 0 }],
  2: [{ hour: 8, minute: 0 }, { hour: 18, minute: 0 }],
  3: [{ hour: 8, minute: 0 }, { hour: 12, minute: 0 }, { hour: 18, minute: 0 }],
};

/** 饭前相对饭后基准的提前分钟数。 */
export const MEAL_BEFORE_OFFSET_MIN = 30;
export const MEAL_BEFORE_OFFSET_MS = MEAL_BEFORE_OFFSET_MIN * MINUTE_MS;

/** 通知预排窗口：只排未来 48 小时。 */
export const SCHEDULE_WINDOW_MS = 48 * HOUR_MS;

/** interval 型计划的取值范围。 */
export const MIN_INTERVAL_HOURS = 1;
export const MAX_INTERVAL_HOURS = 72;

/** 计划时刻已过多久视为「已漏服」（用于展示口径，与推迟无关）。 */
export const MISSED_AFTER_MS = 0;
