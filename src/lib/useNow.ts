/**
 * 1 秒节拍器。对应 legacy MainActivity.startTicker()。
 *
 * 只在需要的地方挂载（今日页），离开页面即停止，
 * 避免 legacy 里 ticker 在 onChange 时可能重复启动的问题。
 */

import { useEffect, useState } from 'react';

/** 返回当前时间戳，每 intervalMs 更新一次。 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
