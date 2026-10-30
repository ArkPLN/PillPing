import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  allResolved,
  clampCount,
  createCycle,
  isStarted,
  projectPendingFromLastTaken,
  resizeCycle,
  rescheduleAfterTaken,
} from '@/lib/cycle';
import { isCourseActive } from '@/lib/med';
import { repairState } from '@/lib/repair';
import { computeNext, computeNextAfterTaken } from '@/lib/specialmed';
import { dateKey } from '@/lib/format';
import {
  DOSE_PENDING,
  DOSE_SKIPPED,
  DOSE_TAKEN,
  type Cycle,
  type HistoryItem,
  type Med,
  type SpecialMed,
} from '@/lib/types';

/** 对应 legacy Store 的 SharedPreferences 名称。 */
const STORAGE_NAME = 'medtimer_data';
const HISTORY_LIMIT = 40;

export type AppState = {
  meds: Med[];
  cycle: Cycle | null;
  history: HistoryItem[];
  specials: SpecialMed[];
  interval: number;
  doseCount: number;
  remindersEnabled: boolean;
  onboarded: boolean;
  lastUseDay: string | null;
  useStreak: number;
};

type Actions = {
  // 设置
  setInterval: (hours: number) => void;
  setDoseCount: (count: number) => void;
  setRemindersEnabled: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;

  // 药物
  addMed: (med: Med) => void;
  updateMed: (med: Med) => void;
  removeMed: (id: string) => void;
  toggleMedEnabled: (id: string) => void;

  // 周期
  startCycle: (firstAt: number, intervalHours: number, count: number) => void;
  markTaken: (index: number) => void;
  markTakenAt: (index: number, atMillis: number) => void;
  skip: (index: number) => void;
  undo: (index: number) => void;
  snooze: (index: number, minutes: number) => void;
  clearToday: () => void;

  // 特殊用药
  addSpecial: (med: SpecialMed) => void;
  updateSpecial: (med: SpecialMed) => void;
  removeSpecial: (id: string) => void;
  toggleSpecialEnabled: (id: string) => void;
  markSpecialTaken: (id: string, atMillis?: number) => void;
  snoozeSpecial: (id: string, minutes: number) => void;
  nextSpecialCode: () => number;

  // 复诊
  setFollowup: (medId: string, nextFollowupAt: number) => void;

  // 维护
  touchDailyUse: () => number;
  clearAll: () => void;
};

const initialState: AppState = {
  meds: [],
  cycle: null,
  history: [],
  specials: [],
  interval: 5,
  doseCount: 3,
  remindersEnabled: true,
  onboarded: false,
  lastUseDay: null,
  useStreak: 1,
};

/** 收集所有药物的名称摘要，用于历史记录。对应 legacy allMedSummary。 */
function allMedSummary(meds: Med[]): string {
  const names = meds.filter((m) => m.enabled).map((m) => m.name);
  return names.length === 0 ? '未配置药物' : names.join('、');
}

/** 把当前 cycle 归档进历史。对应 legacy archiveCurrent。 */
function archive(cycle: Cycle | null, meds: Med[], history: HistoryItem[]): HistoryItem[] {
  if (!cycle || !isStarted(cycle)) return history;

  let taken = 0;
  for (let i = 0; i < cycle.count; i++) if (cycle.status[i] === DOSE_TAKEN) taken++;

  const item: HistoryItem = {
    date: cycle.startDate,
    startAt: cycle.firstAt,
    taken,
    total: cycle.count,
    summary: allMedSummary(meds),
  };
  const next = [item, ...history];
  return next.slice(0, HISTORY_LIMIT);
}

export const useStore = create<AppState & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ---------- 设置 ----------

      setInterval: (hours) => {
        const v = Math.max(1, Math.min(12, hours));
        if (v === get().interval) return;
        set((s) => {
          const cycle =
            s.cycle && isStarted(s.cycle) ? projectPendingFromLastTaken(s.cycle, v) : s.cycle;
          return { interval: v, cycle };
        });
      },

      setDoseCount: (count) => {
        const v = clampCount(count);
        if (v === get().doseCount) return;
        set((s) => {
          if (!s.cycle || !isStarted(s.cycle)) return { doseCount: v };

          const oldSize = s.cycle.count;
          let cycle = resizeCycle(s.cycle, v);
          if (v > oldSize) cycle = projectPendingFromLastTaken(cycle, s.interval);
          return { doseCount: v, cycle };
        });
      },

      setRemindersEnabled: (v) => set({ remindersEnabled: v }),
      setOnboarded: (v) => set({ onboarded: v }),

      // ---------- 药物 ----------

      addMed: (med) => set((s) => ({ meds: [...s.meds, med] })),

      updateMed: (med) =>
        set((s) => ({ meds: s.meds.map((m) => (m.id === med.id ? med : m)) })),

      removeMed: (id) => set((s) => ({ meds: s.meds.filter((m) => m.id !== id) })),

      toggleMedEnabled: (id) =>
        set((s) => ({
          meds: s.meds.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        })),

      // ---------- 周期 ----------

      startCycle: (firstAt, intervalHours, count) => {
        const interval = Math.max(1, Math.min(12, intervalHours));
        const doseCount = clampCount(count);
        const now = Date.now();
        let first = firstAt > 0 ? firstAt : now;
        if (first > now) first = now;

        set((s) => {
          const history = archive(s.cycle, s.meds, s.history);
          const cycle = createCycle(doseCount);
          cycle.firstAt = first;
          cycle.startDate = dateKey(first);
          for (let i = 0; i < doseCount; i++) {
            cycle.planned[i] = first + i * interval * 3600_000;
            cycle.status[i] = DOSE_PENDING;
            cycle.snoozeUntil[i] = 0;
          }
          // 第一次立即记为已服用（legacy 行为）
          cycle.status[0] = DOSE_TAKEN;
          cycle.actedAt[0] = first;

          return { interval, doseCount, cycle, history };
        });
      },

      markTaken: (index) => get().markTakenAt(index, Date.now()),

      markTakenAt: (index, atMillis) => {
        set((s) => {
          const c = s.cycle;
          if (!c || index < 0 || index >= c.count) return {};

          const now = Date.now();
          const at = atMillis > 0 ? Math.min(atMillis, now) : now;

          const status = [...c.status];
          const actedAt = [...c.actedAt];
          const snoozeUntil = [...c.snoozeUntil];
          status[index] = DOSE_TAKEN;
          actedAt[index] = at;
          snoozeUntil[index] = 0;

          let cycle: Cycle = { ...c, status, actedAt, snoozeUntil };
          // 关键：后续所有待服次数都从这次实际服用时间重排
          cycle = rescheduleAfterTaken(cycle, index, s.interval);
          return { cycle };
        });
      },

      skip: (index) => {
        set((s) => {
          const c = s.cycle;
          if (!c || index < 0 || index >= c.count) return {};
          const status = [...c.status];
          const actedAt = [...c.actedAt];
          const snoozeUntil = [...c.snoozeUntil];
          status[index] = DOSE_SKIPPED;
          actedAt[index] = Date.now();
          snoozeUntil[index] = 0;
          // 跳过不重排后续计划（legacy 行为）
          return { cycle: { ...c, status, actedAt, snoozeUntil } };
        });
      },

      undo: (index) => {
        set((s) => {
          const c = s.cycle;
          if (!c || index < 0 || index >= c.count) return {};
          const status = [...c.status];
          const actedAt = [...c.actedAt];
          const snoozeUntil = [...c.snoozeUntil];
          status[index] = DOSE_PENDING;
          actedAt[index] = 0;
          snoozeUntil[index] = 0;
          const cycle = projectPendingFromLastTaken(
            { ...c, status, actedAt, snoozeUntil },
            s.interval
          );
          return { cycle };
        });
      },

      snooze: (index, minutes) => {
        set((s) => {
          const c = s.cycle;
          if (!c || index < 0 || index >= c.count) return {};
          if (c.status[index] !== DOSE_PENDING) return {};

          const now = Date.now();
          const due = c.snoozeUntil[index] > 0 ? c.snoozeUntil[index] : c.planned[index];
          const base = Math.max(now, due);
          const snoozeUntil = [...c.snoozeUntil];
          snoozeUntil[index] = base + Math.max(1, minutes) * 60_000;
          return { cycle: { ...c, snoozeUntil } };
        });
      },

      clearToday: () => set({ cycle: null }),

      // ---------- 特殊用药 ----------

      nextSpecialCode: () => {
        const max = get().specials.reduce((acc, m) => Math.max(acc, m.code), -1);
        return Math.min(127, max + 1);
      },

      addSpecial: (med) =>
        set((s) => {
          let code = s.specials.reduce((acc, m) => Math.max(acc, m.code), -1) + 1;
          code = Math.min(127, code);
          const used = new Set(s.specials.map((m) => m.code));
          if (used.has(code)) {
            for (let i = 0; i < 128; i++) {
              if (!used.has(i)) {
                code = i;
                break;
              }
            }
          }
          return { specials: [...s.specials, { ...med, code }] };
        }),

      updateSpecial: (med) =>
        set((s) => ({ specials: s.specials.map((m) => (m.id === med.id ? med : m)) })),

      removeSpecial: (id) => set((s) => ({ specials: s.specials.filter((m) => m.id !== id) })),

      toggleSpecialEnabled: (id) =>
        set((s) => ({
          specials: s.specials.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        })),

      markSpecialTaken: (id, atMillis) => {
        set((s) => {
          const now = Date.now();
          const at = atMillis && atMillis > 0 ? Math.min(atMillis, now) : now;
          const specials = s.specials.map((m) => {
            if (m.id !== id) return m;
            return {
              ...m,
              lastAt: at,
              snoozeUntil: 0,
              nextAt: computeNextAfterTaken(m, at),
            };
          });
          return { specials };
        });
      },

      snoozeSpecial: (id, minutes) => {
        set((s) => {
          const specials = s.specials.map((m) => {
            if (m.id !== id || !m.enabled) return m;
            const due = m.snoozeUntil > 0 ? m.snoozeUntil : m.nextAt;
            const base = Math.max(Date.now(), due);
            return { ...m, snoozeUntil: base + Math.max(1, minutes) * 60_000 };
          });
          return { specials };
        });
      },

      // ---------- 复诊 ----------

      setFollowup: (medId, nextFollowupAt) =>
        set((s) => ({
          meds: s.meds.map((m) => (m.id === medId ? { ...m, nextFollowupAt } : m)),
        })),

      // ---------- 维护 ----------

      /** 记录连续使用天数。对应 legacy touchDailyUse。 */
      touchDailyUse: () => {
        const today = dateKey(Date.now());
        const { lastUseDay, useStreak } = get();
        if (today === lastUseDay) return Math.max(1, useStreak);

        let streak = 1;
        if (lastUseDay) {
          const last = new Date(`${lastUseDay}T00:00:00`);
          const expected = new Date(last);
          expected.setDate(expected.getDate() + 1);
          if (dateKey(expected.getTime()) === today) streak = Math.max(1, useStreak) + 1;
        }
        set({ lastUseDay: today, useStreak: streak });
        return streak;
      },

      clearAll: () => set({ ...initialState }),
    }),
    {
      name: `${STORAGE_NAME}`,
      storage: createJSONStorage(() => AsyncStorage),
      // 只持久化数据字段，不持久化 action
      partialize: (s): AppState => ({
        meds: s.meds,
        cycle: s.cycle,
        history: s.history,
        specials: s.specials,
        interval: s.interval,
        doseCount: s.doseCount,
        remindersEnabled: s.remindersEnabled,
        onboarded: s.onboarded,
        lastUseDay: s.lastUseDay,
        useStreak: s.useStreak,
      }),
      version: 1,
      // 反序列化后自愈，对应 legacy Store.load() 的修复逻辑
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<AppState>) } as AppState & Actions;
        return { ...merged, ...repairState(merged) };
      },
    }
  )
);

/** 便捷选择器：当前 cycle 是否已全部完成。 */
export function selectAllResolved(s: AppState): boolean {
  return !!s.cycle && allResolved(s.cycle);
}

/** 便捷选择器：是否有生效中的普通药物。 */
export function selectHasActiveMeds(s: AppState, now = Date.now()): boolean {
  return s.meds.some((m) => m.enabled && isCourseActive(m, now));
}
