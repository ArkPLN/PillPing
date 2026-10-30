/**
 * 通知调度器。
 *
 * 与原 legacy 实现的差异（已与用户确认）：
 * legacy 用 AlarmManager 只挂 1 个闹钟，触发后由 Receiver 排下一个（链式单闹钟）。
 * RN 没有等价的「闹钟触发后可靠执行 JS」机制，因此改为：
 *   一次性预排所有待服次数（≤12 条一次性 date trigger），
 *   由应用启动/任意状态变更时全量同步（syncAll）。
 * 用户侧行为完全一致（到点都会收到提醒），只是实现模型不同。
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  effectiveTime,
  isStarted,
  nextPending,
} from '@/lib/cycle';
import { formatMonthDay, formatTime } from '@/lib/format';
import { isCourseActive } from '@/lib/med';
import { effectiveAt } from '@/lib/specialmed';
import type { Cycle, Med, SpecialMed } from '@/lib/types';
import { DOSE_PENDING } from '@/lib/types';

import {
  CATEGORY_DOSE,
  CATEGORY_FOLLOWUP,
  CATEGORY_SPECIAL,
  CHANNEL_ID,
  ensureCategories,
  ensureChannel,
} from './channel';
import { NOTIFICATIONS_SUPPORTED, safeNotify } from './platform';

/** identifier 前缀，用于区分并批量取消。 */
const ID_DOSE = 'dose-';
const ID_SPECIAL = 'special-';
const ID_FOLLOWUP = 'followup-';

export type SchedulerInput = {
  remindersEnabled: boolean;
  interval: number;
  cycle: Cycle | null;
  meds: Med[];
  specials: SpecialMed[];
  /** 第 slot 次应服用的药物名摘要。 */
  summaryForSlot: (slot: number) => string;
  /** 通知正文（多行）。 */
  bigTextForSlot: (slot: number) => string;
};

function doseId(index: number): string {
  return `${ID_DOSE}${index}`;
}

function specialId(id: string): string {
  return `${ID_SPECIAL}${id}`;
}

function followupId(medId: string): string {
  return `${ID_FOLLOWUP}${medId}`;
}

/** 取消所有本应用排定的通知（只取消带我们前缀的，避免误删）。 */
export async function cancelAllScheduled(): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  await safeNotify('cancelAllScheduled', async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((r) => {
          const id = r.identifier ?? '';
          return (
            id.startsWith(ID_DOSE) || id.startsWith(ID_SPECIAL) || id.startsWith(ID_FOLLOWUP)
          );
        })
        .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier))
    );
  });
}

/** 只取消某个普通服药次数的通知。 */
export async function cancelDose(index: number): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(doseId(index));
  } catch {
    // 不存在时忽略
  }
}

export async function cancelSpecial(id: string): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(specialId(id));
  } catch {
    // 忽略
  }
}

export async function cancelFollowup(): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  await safeNotify('cancelFollowup', async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((r) => (r.identifier ?? '').startsWith(ID_FOLLOWUP))
        .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier))
    );
  });
}

/** 立即展示一条通知（用于"预览"与"测试"）。 */
export async function presentNow(opts: {
  title: string;
  body: string;
  category?: string;
  data?: Record<string, unknown>;
  color?: string;
}): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  await ensureChannel();
  await safeNotify('presentNow', () =>
    Notifications.scheduleNotificationAsync({
      identifier: undefined,
      content: {
        title: opts.title,
        body: opts.body,
        categoryIdentifier: opts.category,
        data: opts.data,
        color: opts.color,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      // null = 立即展示
      trigger: null,
    })
  );
}

/** 排定一条延时通知（用于 10 秒后台测试）。 */
export async function scheduleTestIn(seconds: number): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  await ensureChannel();
  await safeNotify('scheduleTestIn', () =>
    Notifications.scheduleNotificationAsync({
      identifier: 'background-test',
      content: {
        title: '后台测试提醒 · 成功',
        body: '应用在后台也能收到这条提醒。',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    })
  );
}

async function scheduleAt(
  identifier: string,
  when: number,
  content: {
    title: string;
    body: string;
    categoryIdentifier?: string;
    subtitle?: string;
    color?: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;
  // 只接受未来的时间；已过期的不排（避免立即弹出历史提醒）
  if (when <= Date.now()) return false;
  const ok = await safeNotify('scheduleAt', async () => {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: content.title,
        body: content.body,
        subtitle: content.subtitle,
        categoryIdentifier: content.categoryIdentifier,
        color: content.color,
        data: content.data,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(when),
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
    return true;
  });
  return ok === true;
}

/**
 * 全量同步：先取消本应用排定的一切，再按当前状态重新排。
 *
 * 普通服药：为「每一个待服次数」各排一条一次性通知（批量预排）。
 * 特殊用药：每种一条（下次提醒）。
 * 复诊：只排最早的一条（对应 legacy FollowupScheduler 的策略）。
 */
export async function syncAll(input: SchedulerInput, now = Date.now()): Promise<void> {
  await ensureCategories();
  await cancelAllScheduled();

  if (!input.remindersEnabled) return;

  // ---- 普通服药 ----
  const cycle = input.cycle;
  const hasActive = input.meds.some((m) => m.enabled && isCourseActive(m, now));
  if (cycle && isStarted(cycle) && hasActive) {
    for (let i = 0; i < cycle.count; i++) {
      if (cycle.status[i] !== DOSE_PENDING) continue;
      const due = effectiveTime(cycle, i);
      if (due <= now) continue;

      const summary = input.summaryForSlot(i) || '还没有配置本次药物，点开应用添加';
      const dayLabel = formatMonthDay(due);
      const time = formatTime(due);

      await scheduleAt(doseId(i), due, {
        title: `该吃药了 · 第${i + 1}次`,
        body: summary,
        categoryIdentifier: CATEGORY_DOSE,
        subtitle: `每天 ${cycle.count} 次 · 间隔 ${input.interval} 小时`,
        data: { kind: 'dose', index: i, due, when: `${dayLabel} ${time}` },
      });
    }
  }

  // ---- 特殊用药 ----
  for (const m of input.specials) {
    if (!m.enabled) continue;
    const due = effectiveAt(m);
    if (due <= 0) continue;

    const scheduleLabel =
      m.mode === 0 ? `每 ${m.intervalHours} 小时` : `每天 ${pad2(m.hour)}:${pad2(m.minute)}`;

    await scheduleAt(specialId(m.id), due, {
      title: `特殊用药 · ${m.name}`,
      body: `${m.dose}（${m.method}）`,
      categoryIdentifier: CATEGORY_SPECIAL,
      subtitle: `独立提醒 · ${scheduleLabel}`,
      color: '#7C3AED',
      data: { kind: 'special', id: m.id, due },
    });
  }

  // ---- 复诊：只排最早一条 ----
  let earliest: Med | null = null;
  for (const m of input.meds) {
    if (!m.enabled || !isCourseActive(m, now)) continue;
    if (m.followupDays <= 0 || m.nextFollowupAt <= 0) continue;
    if (!earliest || m.nextFollowupAt < earliest.nextFollowupAt) earliest = m;
  }
  if (earliest) {
    await scheduleAt(followupId(earliest.id), earliest.nextFollowupAt, {
      title: `复诊提醒 · ${earliest.name}`,
      body: '服药期间建议复诊',
      categoryIdentifier: CATEGORY_FOLLOWUP,
      subtitle: '复诊提醒',
      color: '#B45309',
      data: { kind: 'followup', medId: earliest.id },
    });
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 仅重排普通服药的「下一个」待服次数。
 * 用于推迟 10 分钟这类只需单点更新的场景。
 */
export async function syncNextDoseOnly(input: SchedulerInput, now = Date.now()): Promise<void> {
  const cycle = input.cycle;
  if (!cycle || !isStarted(cycle)) return;

  const next = nextPending(cycle);
  if (next < 0) return;

  await cancelDose(next);
  if (!input.remindersEnabled) return;

  const due = effectiveTime(cycle, next);
  if (due <= now) return;

  const summary = input.summaryForSlot(next) || '还没有配置本次药物，点开应用添加';
  await scheduleAt(doseId(next), due, {
    title: `该吃药了 · 第${next + 1}次`,
    body: summary,
    categoryIdentifier: CATEGORY_DOSE,
    subtitle: `每天 ${cycle.count} 次 · 间隔 ${input.interval} 小时`,
    data: { kind: 'dose', index: next, due },
  });
}
