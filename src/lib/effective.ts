/**
 * "推迟优先"的到点时间——统一语义的唯一实现。
 *
 * 语义：存在推迟目标时刻（snoozeUntil > 0）时返回推迟目标，
 * 否则返回计划时刻。普通药与特殊用药共用同一口径。
 */

/**
 * 计算一次服药的到点时间。
 * @param snoozeUntil 推迟目标时刻（毫秒）；0 或负数表示无推迟
 * @param scheduled 计划时刻（毫秒）
 * @returns 有推迟时返回 snoozeUntil，否则返回 scheduled
 */
export function effectiveDue(snoozeUntil: number, scheduled: number): number {
  return snoozeUntil > 0 ? snoozeUntil : scheduled;
}
