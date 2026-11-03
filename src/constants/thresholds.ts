/**
 * 业务阈值常量。跨页面共用同一判定口径，集中在此维护。
 */

import { MINUTE_MS } from './time';

/**
 * 距计划时刻超过该毫秒数时，提前记录服用需二次确认。
 * 当前值为 30 分钟。
 */
export const BACKFILL_CONFIRM_AFTER_MS = 30 * MINUTE_MS;

/**
 * 到点后该宽限窗口内（毫秒）不显示"已超时 X 分钟"，
 * 而显示"已到服药时间"。当前值为 1 分钟。
 */
export const DUE_GRACE_MS = MINUTE_MS;
