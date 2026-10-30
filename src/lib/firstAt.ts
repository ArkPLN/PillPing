import { create } from 'zustand';

import { dateKey } from './format';

/**
 * 今日页「第一次服药时间」的选择状态。
 *
 * 原 legacy 用 MainActivity 的 firstAtChoice 字段保存，
 * 在 RN 里由独立页面（time-picker）选择后再回传，
 * 因此需要一个跨页面的共享状态。
 *
 * 规则与 legacy ensureFirstAtChoice() 一致：
 * 跨天（或首次使用）时重置为当前分钟。
 */
type FirstAtState = {
  firstAt: number;
  ensure: () => number;
  set: (millis: number) => void;
  reset: () => void;
};

function roundToMinute(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}

export const useFirstAt = create<FirstAtState>((set, get) => ({
  firstAt: 0,

  ensure: () => {
    const now = Date.now();
    const current = get().firstAt;
    if (current <= 0 || dateKey(current) !== dateKey(now)) {
      const next = roundToMinute(now);
      set({ firstAt: next });
      return next;
    }
    return current;
  },

  set: (millis) => set({ firstAt: millis }),

  reset: () => set({ firstAt: 0 }),
}));
