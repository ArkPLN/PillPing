/**
 * 通知响应处理。
 *
 * 普通药按 (medId, slotKey, dateKey) 记录；特殊用药按 (id, recordKey) 记录。
 * 旧版本通知（仅带 index）会被安全忽略。
 */

import * as Notifications from 'expo-notifications';

import { useStore } from '@/store/useStore';
import { DAY_MS } from '@/constants/time';
import type { Med, SpecialMed } from '@/lib/types';

import {
  ACTION_FOLLOWUP_DONE,
  ACTION_FOLLOWUP_TOMORROW,
  ACTION_MARK,
  ACTION_SNOOZE,
} from './channel';
import { cancelDose, cancelSpecial, presentNow, syncAll } from './scheduler';
import { buildSchedulerInput } from './input';

type DoseData = {
  kind: 'dose';
  medId: string;
  slotKey: string;
  dateKey: string;
  due?: number;
};
type SpecialData = { kind: 'special'; id: string; recordKey: string; due?: number };
type FollowupData = { kind: 'followup'; medId: string };

function isDose(d: unknown): d is DoseData {
  if (!d || typeof d !== 'object') return false;
  const v = d as DoseData;
  return (
    v.kind === 'dose' &&
    typeof v.medId === 'string' &&
    typeof v.slotKey === 'string' &&
    typeof v.dateKey === 'string'
  );
}
function isSpecial(d: unknown): d is SpecialData {
  if (!d || typeof d !== 'object') return false;
  const v = d as SpecialData;
  return v.kind === 'special' && typeof v.id === 'string' && typeof v.recordKey === 'string';
}
function isFollowup(d: unknown): d is FollowupData {
  return !!d && typeof d === 'object' && (d as FollowupData).kind === 'followup';
}

async function resync(): Promise<void> {
  await syncAll(buildSchedulerInput());
}

/**
 * 处理一次通知响应。
 * 返回 true 表示已处理（调用方可据此决定是否跳转页面）。
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<boolean> {
  const actionId = response.actionIdentifier;
  const data = response.notification.request.content.data;

  if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) return false;

  const store = useStore.getState();

  // ---------- 普通药 ----------
  if (isDose(data)) {
    const { medId, slotKey, dateKey } = data;

    if (actionId === ACTION_MARK) {
      store.markTaken(medId, slotKey, dateKey);
      await cancelDose(medId, slotKey, dateKey);
      await resync();
      return true;
    }

    if (actionId === ACTION_SNOOZE) {
      store.snooze(medId, slotKey, dateKey, 10);
      await cancelDose(medId, slotKey, dateKey);
      await resync();
      await presentNow({
        title: '将在 10 分钟后提醒',
        body: '本次服药已推迟',
        category: undefined,
      });
      return true;
    }
    return false;
  }

  // ---------- 特殊用药 ----------
  if (isSpecial(data)) {
    const m: SpecialMed | undefined = store.specials.find((s) => s.id === data.id);
    if (!m) return false;

    if (actionId === ACTION_MARK) {
      store.markSpecialTaken(m.id, data.recordKey);
      await cancelSpecial(m.id, data.recordKey);
      await resync();
      return true;
    }

    if (actionId === ACTION_SNOOZE) {
      store.snoozeSpecial(m.id, data.recordKey, 10);
      await cancelSpecial(m.id, data.recordKey);
      await resync();
      await presentNow({
        title: '将在 10 分钟后提醒',
        body: `${m.name} 已推迟`,
      });
      return true;
    }
    return false;
  }

  // ---------- 复诊 ----------
  if (isFollowup(data)) {
    const med: Med | undefined = store.meds.find((x) => x.id === data.medId);
    if (!med) return false;

    if (actionId === ACTION_FOLLOWUP_DONE) {
      const days = Math.max(1, med.followupDays);
      store.setFollowup(med.id, Date.now() + days * DAY_MS);
      await resync();
      return true;
    }

    if (actionId === ACTION_FOLLOWUP_TOMORROW) {
      store.setFollowup(med.id, Date.now() + DAY_MS);
      await resync();
      return true;
    }
    return false;
  }

  return false;
}
