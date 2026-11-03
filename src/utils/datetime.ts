/**
 * 日期取整工具。
 */

/**
 * 取某个时刻当天零点（本地时区）的时间戳。
 * @param d 任意时刻
 * @returns 该时刻所在日的 00:00:00.000 本地时间戳（毫秒）
 */
export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * 取今天零点（本地时区）的时间戳。
 * @param now 当前时刻，缺省为系统当前时间
 * @returns 今天 00:00:00.000 本地时间戳（毫秒）
 */
export function startOfToday(now: number = Date.now()): number {
  return startOfDay(new Date(now));
}
