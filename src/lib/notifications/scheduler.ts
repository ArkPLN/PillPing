/**
 * 通知调度器（v3 每药计划）。
 *
 * 全量同步：先取消本应用排定的一切，再按当前记录重新排定。
 * - 普通药：未来 48h 内每药每槽位一条一次性通知；interval 只排下一个待服；
 * - 特殊用药：每种排下一剂；
 * - 复诊：只排最早的一条。
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatMonthDay, formatTime } from '@/lib/format';
import { planSummary } from '@/lib/med';
import { effectiveAt, modeText, recordKeyFor } from '@/lib/specialmed';
import { slotDose } from '@/lib/plan';
import { COLORS } from '@/lib/colors';
import { SCHEDULE_WINDOW_MS } from '@/constants/plan';
import type { DoseRecord, Med, SpecialMed } from '@/lib/types';

import {
  CATEGORY_DOSE,
  CATEGORY_FOLLOWUP,
  CATEGORY_SPECIAL,
  CHANNEL_ID,
  ensureCategories,
  ensureChannel,
} from './channel';
import { NOTIFICATIONS_SUPPORTED, safeNotify } from './platform';
import {
  DOSE_PREFIX,
  FOLLOWUP_PREFIX,
  SPECIAL_PREFIX,
  doseIdentifier,
  followupIdentifier,
  selectWindowEntries,
  specialIdentifier,
} from './core';

export type SchedulerInput = {
  remindersEnabled: boolean;
  meds: Med[];
  records: DoseRecord[];
  specials: SpecialMed[];
};

/** 取消所有本应用排定的通知（只取消带我们前缀的）。 */
export async function cancelAllScheduled(): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  await safeNotify('cancelAllScheduled', async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((r) => {
          const id = r.identifier ?? '';
          return (
            id.startsWith(DOSE_PREFIX) ||
            id.startsWith(SPECIAL_PREFIX) ||
            id.startsWith(FOLLOWUP_PREFIX)
          );
        })
        .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier))
    );
  });
}

/** 只取消某个普通药剂量。 */
export async function cancelDose(
  medId: string,
  slotKey: string,
  dateKey: string
): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(doseIdentifier(medId, slotKey, dateKey));
  } catch {
    // 不存在时忽略
  }
}

export async function cancelSpecial(id: string, recordKey: string): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(specialIdentifier(id, recordKey));
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
        .filter((r) => (r.identifier ?? '').startsWith(FOLLOWUP_PREFIX))
        .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier))
    );
  });
}

/** 立即展示一条通知（用于预览与测试）。 */
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
      trigger: null,
    })
  );
}

/** 排定一条延时通知（用于后台测试）。 */
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

function doseBody(med: Med, entrySlotKey: string): string {
  const slot = med.plan.type === 'interval'
    ? undefined
    : med.plan.slots.find((s) => s.id === entrySlotKey);
  const dose = slot ? slotDose(med, slot) : { qty: med.doseQty, unit: med.doseUnit };
  let line = `${dose.qty}${dose.unit}（${med.method}）`;
  if (med.note) line += ` · ${med.note}`;
  return line;
}

/**
 * 全量同步：取消所有已排通知，按当前状态重新排。
 */
export async function syncAll(input: SchedulerInput, now = Date.now()): Promise<void> {
  await ensureCategories();
  await cancelAllScheduled();

  if (!input.remindersEnabled) return;

  // ---- 普通药：未来 48h ----
  const entries = selectWindowEntries(input.meds, input.records, now, SCHEDULE_WINDOW_MS);
  for (const entry of entries) {
    const med = input.meds.find((m) => m.id === entry.medId);
    if (!med) continue;

    const dayLabel = formatMonthDay(entry.due);
    const time = formatTime(entry.due);
    await scheduleAt(
      doseIdentifier(entry.medId, entry.slotKey, entry.dateKey),
      entry.due,
      {
        title: '该吃药了',
        body: doseBody(med, entry.slotKey),
        categoryIdentifier: CATEGORY_DOSE,
        subtitle: planSummary(med),
        data: {
          kind: 'dose',
          medId: entry.medId,
          slotKey: entry.slotKey,
          dateKey: entry.dateKey,
          due: entry.due,
          when: `${dayLabel} ${time}`,
        },
      }
    );
  }

  // ---- 特殊用药：下一剂 ----
  for (const m of input.specials) {
    if (!m.enabled) continue;
    const due = effectiveAt(m);
    if (due <= 0) continue;

    await scheduleAt(specialIdentifier(m.id, recordKeyFor(due)), due, {
      title: `特殊用药 · ${m.name}`,
      body: `${m.doseQty}${m.doseUnit}（${m.method}）`,
      categoryIdentifier: CATEGORY_SPECIAL,
      subtitle: modeText(m),
      color: COLORS.violet.light,
      data: { kind: 'special', id: m.id, recordKey: recordKeyFor(due), due },
    });
  }

  // ---- 复诊：只排最早一条 ----
  let earliest: Med | null = null;
  for (const m of input.meds) {
    if (!m.enabled) continue;
    if (m.followupDays <= 0 || m.nextFollowupAt <= 0) continue;
    if (!earliest || m.nextFollowupAt < earliest.nextFollowupAt) earliest = m;
  }
  if (earliest) {
    await scheduleAt(followupIdentifier(earliest.id), earliest.nextFollowupAt, {
      title: `复诊提醒 · ${earliest.name}`,
      body: '服药期间建议复诊',
      categoryIdentifier: CATEGORY_FOLLOWUP,
      subtitle: '复诊提醒',
      color: COLORS.amber.light,
      data: { kind: 'followup', medId: earliest.id },
    });
  }
}
