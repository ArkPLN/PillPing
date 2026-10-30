/**
 * 通知渠道与类目定义。
 *
 * 渠道参数对应 legacy NotificationHelper.ensureChannel()：
 * - channel id: med_reminders_v2
 * - 名称：服药提醒
 * - IMPORTANCE_HIGH、振动 [0,450,220,450]、锁屏可见 PUBLIC、角标
 *
 * 类目对应 legacy 的三个 Receiver：
 * - dose：已服用 / 10 分钟后
 * - special：已服用 / 10 分钟后
 * - followup：已复诊 / 明天再提醒
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { COLORS } from '@/lib/colors';
import { NOTIFICATIONS_SUPPORTED, safeNotify } from './platform';

export const CHANNEL_ID = 'med_reminders_v2';
export const CHANNEL_NAME = '服药提醒';
export const CHANNEL_DESC = '到点提醒你按时服药';

export const CATEGORY_DOSE = 'dose';
export const CATEGORY_SPECIAL = 'special';
export const CATEGORY_FOLLOWUP = 'followup';

export const ACTION_MARK = 'MARK_TAKEN';
export const ACTION_SNOOZE = 'SNOOZE_10';
export const ACTION_FOLLOWUP_DONE = 'FOLLOWUP_DONE';
export const ACTION_FOLLOWUP_TOMORROW = 'FOLLOWUP_TOMORROW';

/**
 * 创建/更新通知渠道。
 * Android 8+ 需要先建渠道再发通知，否则通知会被系统丢弃。
 */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await safeNotify('ensureChannel', () =>
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: CHANNEL_NAME,
      description: CHANNEL_DESC,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 450, 220, 450],
      enableVibrate: true,
      enableLights: true,
      lightColor: COLORS.primary.light,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      sound: 'default',
      bypassDnd: false,
    })
  );
}

/** 注册通知操作按钮类目。 */
export async function ensureCategories(): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;

  await safeNotify('ensureCategories', async () => {
    await Notifications.setNotificationCategoryAsync(CATEGORY_DOSE, [
      { identifier: ACTION_MARK, buttonTitle: '已服用' },
      { identifier: ACTION_SNOOZE, buttonTitle: '10 分钟后' },
    ]);

    await Notifications.setNotificationCategoryAsync(CATEGORY_SPECIAL, [
      { identifier: ACTION_MARK, buttonTitle: '已服用' },
      { identifier: ACTION_SNOOZE, buttonTitle: '10 分钟后' },
    ]);

    await Notifications.setNotificationCategoryAsync(CATEGORY_FOLLOWUP, [
      { identifier: ACTION_FOLLOWUP_DONE, buttonTitle: '已复诊' },
      { identifier: ACTION_FOLLOWUP_TOMORROW, buttonTitle: '明天再提醒' },
    ]);
  });
}

/**
 * 前台收到通知时的展示策略。
 * legacy 从不弹全屏页，只发横幅/声音/振动 —— 这里保持同样克制。
 */
export function configureForegroundHandler(): void {
  if (!NOTIFICATIONS_SUPPORTED) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (err) {
    if (__DEV__) console.warn('[notifications] setNotificationHandler failed:', err);
  }
}

export async function initNotifications(): Promise<void> {
  configureForegroundHandler();
  await ensureChannel();
  await ensureCategories();
}
