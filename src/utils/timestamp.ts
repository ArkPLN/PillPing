/**
 * 时间戳钳制工具。
 */

/**
 * 把补登时刻钳制到不晚于当前时刻。
 * @param atMillis 待记录的时刻（毫秒）；≤0 视为未提供
 * @param now 当前时刻（毫秒），作为钳制上限
 * @returns atMillis 有效时取 min(atMillis, now)，否则返回 now
 */
export function clampAt(atMillis: number, now: number): number {
  return atMillis > 0 ? Math.min(atMillis, now) : now;
}
