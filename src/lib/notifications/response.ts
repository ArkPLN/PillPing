/**
 * 通知响应处理。
 *
 * 对应 legacy 的三个 Receiver：
 * - ActionReceiver（普通服药：已服用 / 10 分钟后）
 * - SpecialActionReceiver（特殊用药：已服用 / 10 分钟后）
 * - FollowupActionReceiver（复诊：已复诊 / 明天再提醒）
 *
 * 用 useStore.getState() 直接读改写，保证在后台任务里也能工作，
 * 不依赖 React 渲染上下文。
 */

import * as Notifications from 'expo-notifications';

import { useStore } from '@/store/useStore';
import type { Med, SpecialMed } from '@/lib/types';

import {
  ACTION_FOLLOWUP_DONE,
  ACTION_FOLLOWUP_TOMORROW,
  ACTION_MARK,
  ACTION_SNOOZE,
} from './channel';
import { cancelDose, cancelSpecial, presentNow, syncAll, type SchedulerInput } from './scheduler';
import { buildSchedulerInput } from './input';

type DoseData = { kind: 'dose'; index: number; due: number };
type SpecialData = { kind: 'special'; id: string; due: number };
type FollowupData = { kind: 'followup'; medId: string };

function isDose(d: unknown): d is DoseData {
  return !!d && typeof d === 'object' && (d as DoseData).kind === 'dose';
}
function isSpecial(d: unknown): d is SpecialData {
  return !!d && typeof d === 'object' && (d as SpecialData).kind === 'special';
}
function isFollowup(d: unknown): d is FollowupData {
  return !!d && typeof d === 'object' && (d as FollowupData).kind === 'followup';
}

async function resync(): Promise<void> {
  const input: SchedulerInput = buildSchedulerInput();
  await syncAll(input);
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

  // 用户直接点击通知本体（非按钮）→ 只交给 UI 导航，不改数据
  if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) return false;

  const store = useStore.getState();

  // ---------- 普通服药 ----------
  if (isDose(data)) {
    const index = data.index;

    if (actionId === ACTION_MARK) {
      store.markTaken(index);
      await cancelDose(index);
      await resync();
      return true;
    }

    if (actionId === ACTION_SNOOZE) {
      store.snooze(index, 10);
      await cancelDose(index);
      await resync();
      await presentNow({
        title: '将在 10 分钟后提醒',
        body: `第${index + 1}次服药已推迟`,
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
      store.markSpecialTaken(m.id);
      await cancelSpecial(m.id);
      await resync();
      return true;
    }

    if (actionId === ACTION_SNOOZE) {
      store.snoozeSpecial(m.id, 10);
      await cancelSpecial(m.id);
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
      store.setFollowup(med.id, Date.now() + days * 86_400_000);
      await resync();
      return true;
    }

    if (actionId === ACTION_FOLLOWUP_TOMORROW) {
      store.setFollowup(med.id, Date.now() + 86_400_000);
      await resync();
      return true;
    }
    return false;
  }

  return false;
}
