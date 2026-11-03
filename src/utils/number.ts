/**
 * 数字格式化工具。
 */

/**
 * 把非负整数补齐为两位十进制字符串。
 * @param n 要格式化的非负整数（≥10 原样返回）
 * @returns 两位数字符串，如 7 → "07"、13 → "13"
 */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
