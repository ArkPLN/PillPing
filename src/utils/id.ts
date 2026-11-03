/**
 * 实体 ID 生成工具。
 */

/**
 * 生成一个实体 ID：当前毫秒时间戳 + 6 位 36 进制随机串。
 * @returns 形如 "1730000000000-k3j9x2" 的字符串
 */
export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
