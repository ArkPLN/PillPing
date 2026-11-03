import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { repairState } from '@/lib/repair';
import { computeNext, computeNextAfterTaken, recordKeyFor } from '@/lib/specialmed';
import { aggregateDay } from '@/lib/timeline';
import { dayStartOf, timeAt } from '@/lib/plan';
import { dateKey } from '@/lib/format';
import { clampAt } from '@/utils/timestamp';
import { MINUTE_MS } from '@/constants/time';
import { genId } from '@/utils/id';
import {
  DOSE_PENDING,
  DOSE_SKIPPED,
  DOSE_TAKEN,
  type DoseRecord,
  type HistoryItem,
  type Med,
  type SavedPlan,
  type SchedulePlan,
  type SpecialMed,
} from '@/lib/types';

/** 存储 key（沿用旧名称，结构版本由 persist version 控制）。 */
const STORAGE_NAME = 'medtimer_data';
const HISTORY_DAYS = 3;

export type AppState = {
  meds: Med[];
  records: DoseRecord[];
  specials: SpecialMed[];
  templates: SavedPlan[];
  remindersEnabled: boolean;
  onboarded: boolean;
  lastUseDay: string | null;
  useStreak: number;
  /** 旧版本数据被重置时置 true，由启动层消费后清除；不持久化。 */
  storageResetNotice: boolean;
};

type Actions = {
  setRemindersEnabled: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;

  addMed: (med: Med) => void;
  updateMed: (med: Med) => void;
  removeMed: (id: string) => void;
  toggleMedEnabled: (id: string) => void;

  markTaken: (medId: string, slotKey: string, dateKey: string) => void;
  markTakenAt: (medId: string, slotKey: string, dateKey: string, atMillis: number) => void;
  skip: (medId: string, slotKey: string, dateKey: string) => void;
  undo: (medId: string, slotKey: string, dateKey: string) => void;
  snooze: (medId: string, slotKey: string, dateKey: string, minutes: number) => void;

  addSpecial: (med: SpecialMed) => void;
  updateSpecial: (med: SpecialMed) => void;
  removeSpecial: (id: string) => void;
  toggleSpecialEnabled: (id: string) => void;
  markSpecialTaken: (id: string, recordKey: string, atMillis?: number) => void;
  snoozeSpecial: (id: string, recordKey: string, minutes: number) => void;
  nextSpecialCode: () => number;

  saveTemplate: (name: string, plan: SchedulePlan) => void;
  removeTemplate: (id: string) => void;

  setFollowup: (medId: string, nextFollowupAt: number) => void;

  touchDailyUse: () => number;
  clearToday: () => void;
  consumeStorageResetNotice: () => void;
  clearAll: () => void;
};

export const initialState: AppState = {
  meds: [],
  records: [],
  specials: [],
  templates: [],
  remindersEnabled: true,
  onboarded: false,
  lastUseDay: null,
  useStreak: 1,
  storageResetNotice: false,
};

function plannedAtFor(media: Med | undefined, slotKey: string, dayKey: string): number {
  if (media) {
    if (media.plan.type !== 'interval') {
      const slot = media.plan.slots.find((s) => s.id === slotKey);
      if (slot) return timeAt(dayKey, slot.hour, slot.minute);
    } else if (slotKey.startsWith('iv-')) {
      const n = Number(slotKey.slice(3));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return dayStartOf(dayKey);
}

function upsertRecord(
  records: DoseRecord[],
  next: DoseRecord
): DoseRecord[] {
  const index = records.findIndex(
    (r) => r.medId === next.medId && r.slotKey === next.slotKey && r.dateKey === next.dateKey
  );
  if (index < 0) return [...records, next];
  const copy = records.slice();
  copy[index] = next;
  return copy;
}

function recordFor(
  state: AppState,
  medId: string,
  slotKey: string,
  dayKey: string
): DoseRecord | undefined {
  return state.records.find(
    (r) => r.medId === medId && r.slotKey === slotKey && r.dateKey === dayKey
  );
}

function withRecord(
  state: AppState,
  medId: string,
  slotKey: string,
  dayKey: string,
  patch: Partial<DoseRecord>
): DoseRecord[] {
  const med = state.meds.find((m) => m.id === medId);
  const base = recordFor(state, medId, slotKey, dayKey);
  const record: DoseRecord = {
    medId,
    slotKey,
    dateKey: dayKey,
    plannedAt: base?.plannedAt || plannedAtFor(med, slotKey, dayKey),
    status: base?.status ?? DOSE_PENDING,
    actedAt: base?.actedAt ?? 0,
    snoozeUntil: base?.snoozeUntil ?? 0,
    ...patch,
  };
  return upsertRecord(state.records, record);
}

export const useStore = create<AppState & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ---------- 设置 ----------
      setRemindersEnabled: (v) => set({ remindersEnabled: v }),
      setOnboarded: (v) => set({ onboarded: v }),

      // ---------- 药物 ----------
      addMed: (med) => set((s) => ({ meds: [...s.meds, med] })),
      updateMed: (med) => set((s) => ({ meds: s.meds.map((m) => (m.id === med.id ? med : m)) })),
      removeMed: (id) =>
        set((s) => ({
          meds: s.meds.filter((m) => m.id !== id),
          records: s.records.filter((r) => r.medId !== id),
        })),
      toggleMedEnabled: (id) =>
        set((s) => ({
          meds: s.meds.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        })),

      // ---------- 剂量记录 ----------
      markTaken: (medId, slotKey, dayKey) => get().markTakenAt(medId, slotKey, dayKey, Date.now()),

      markTakenAt: (medId, slotKey, dayKey, atMillis) => {
        const at = clampAt(atMillis, Date.now());
        set((s) => ({
          records: withRecord(s, medId, slotKey, dayKey, {
            status: DOSE_TAKEN,
            actedAt: at,
            snoozeUntil: 0,
          }),
        }));
        get().touchDailyUse();
      },

      skip: (medId, slotKey, dayKey) => {
        set((s) => ({
          records: withRecord(s, medId, slotKey, dayKey, {
            status: DOSE_SKIPPED,
            actedAt: Date.now(),
            snoozeUntil: 0,
          }),
        }));
      },

      undo: (medId, slotKey, dayKey) => {
        set((s) => ({
          records: s.records.filter(
            (r) => !(r.medId === medId && r.slotKey === slotKey && r.dateKey === dayKey)
          ),
        }));
      },

      snooze: (medId, slotKey, dayKey, minutes) => {
        set((s) => {
          const existing = recordFor(s, medId, slotKey, dayKey);
          if (existing && existing.status !== DOSE_PENDING) return {};
          const med = s.meds.find((m) => m.id === medId);
          const planned = existing?.plannedAt || plannedAtFor(med, slotKey, dayKey);
          const base = Math.max(Date.now(), planned, existing?.snoozeUntil ?? 0);
          return {
            records: withRecord(s, medId, slotKey, dayKey, {
              status: DOSE_PENDING,
              snoozeUntil: base + Math.max(1, minutes) * MINUTE_MS,
            }),
          };
        });
      },

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

      markSpecialTaken: (id, recordKey, atMillis) => {
        set((s) => {
          const at = clampAt(atMillis ?? 0, Date.now());
          const specials = s.specials.map((m) => {
            if (m.id !== id) return m;
            const due = parseDueFromKey(recordKey) || m.nextAt;
            const record: import('@/lib/types').SpecialRecord = {
              key: recordKey || recordKeyFor(due),
              due,
              status: DOSE_TAKEN,
              actedAt: at,
              snoozeUntil: 0,
            };
            const records = [
              ...m.records.filter((r) => r.key !== record.key),
              record,
            ];
            const updated: SpecialMed = {
              ...m,
              records,
              lastAt: at,
              snoozeUntil: 0,
            };
            return { ...updated, nextAt: computeNextAfterTaken(updated, at) };
          });
          return { specials };
        });
        get().touchDailyUse();
      },

      snoozeSpecial: (id, recordKey, minutes) => {
        set((s) => {
          const specials = s.specials.map((m) => {
            if (m.id !== id || !m.enabled) return m;
            const due = parseDueFromKey(recordKey) || m.nextAt;
            const base = Math.max(Date.now(), due);
            return { ...m, snoozeUntil: base + Math.max(1, minutes) * MINUTE_MS };
          });
          return { specials };
        });
      },

      // ---------- 模板 ----------
      saveTemplate: (name, plan) =>
        set((s) => ({
          templates: [...s.templates, { id: genId(), name, plan }],
        })),

      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      // ---------- 复诊 ----------
      setFollowup: (medId, nextFollowupAt) =>
        set((s) => ({
          meds: s.meds.map((m) => (m.id === medId ? { ...m, nextFollowupAt } : m)),
        })),

      // ---------- 维护 ----------
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

      consumeStorageResetNotice: () => set({ storageResetNotice: false }),

      clearToday: () => {
        const today = dateKey(Date.now());
        set((s) => ({ records: s.records.filter((r) => r.dateKey !== today) }));
      },

      clearAll: () => set({ ...initialState }),
    }),
    {
      name: STORAGE_NAME,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): AppState => ({
        meds: s.meds,
        records: s.records,
        specials: s.specials,
        templates: s.templates,
        remindersEnabled: s.remindersEnabled,
        onboarded: s.onboarded,
        lastUseDay: s.lastUseDay,
        useStreak: s.useStreak,
        storageResetNotice: false,
      }),
      version: 3,
      migrate: (persisted, version) => {
        if (version < 3) {
          return { ...initialState, onboarded: true, storageResetNotice: true };
        }
        return persisted as AppState;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const merged = {
          ...current,
          meds: p.meds ?? current.meds,
          records: p.records ?? current.records,
          specials: p.specials ?? current.specials,
          templates: p.templates ?? current.templates,
          remindersEnabled: p.remindersEnabled ?? current.remindersEnabled,
          onboarded: p.onboarded ?? current.onboarded,
          lastUseDay: p.lastUseDay ?? current.lastUseDay,
          useStreak: p.useStreak ?? current.useStreak,
          storageResetNotice: p.storageResetNotice ?? current.storageResetNotice,
        } as AppState & Actions;
        return { ...merged, ...repairState(merged) };
      },
    }
  )
);

/** 解析特殊用药记录 key（YYYY-MM-DD-HH:mm）中的到点时刻。 */
export function parseDueFromKey(key: string): number {
  const m = /^(\d{4}-\d{2}-\d{2})-(\d{2}):(\d{2})$/.exec(key);
  if (!m) return 0;
  const [y, mo, d] = m[1].split('-').map(Number);
  return new Date(y, mo - 1, d, Number(m[2]), Number(m[3]), 0, 0).getTime();
}

/** 最近 N 天的历史（不含今天），由记录派生。 */
export function buildHistory(
  meds: Med[],
  records: DoseRecord[],
  days = HISTORY_DAYS
): HistoryItem[] {
  const today = dateKey(Date.now());
  const out: HistoryItem[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = dateKey(date.getTime());
    if (key === today) continue;
    const agg = aggregateDay(meds, records, key, Date.now());
    if (agg.total === 0) continue;
    const names = Array.from(new Set(agg.entries.map((e) => e.med.name)));
    out.push({
      date: key,
      taken: agg.taken,
      total: agg.total,
      summary: names.length > 0 ? names.join('、') : '未配置药物',
    });
  }
  return out;
}

/** 便捷选择器：从 state 派生历史。 */
export function selectHistory(state: AppState, days = HISTORY_DAYS): HistoryItem[] {
  return buildHistory(state.meds, state.records, days);
}
