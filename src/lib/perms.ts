/**
 * 权限与系统设置。对应 legacy Perms.java。
 *
 * 能可靠读取的：通知权限、精确闹钟权限、勿扰状态（部分机型不可靠）。
 * 只能跳转无法回读的：电池优化白名单、厂商自启动。
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

import { COLORS } from '@/lib/colors';
import { CHANNEL_ID, ensureChannel } from './notifications/channel';
import { NOTIFICATIONS_SUPPORTED } from './notifications/platform';

const PKG = Constants.expoConfig?.android?.package ?? 'com.expo.arkpln.pillping';

/** 对应 legacy Perms.notificationsEnabled。 */
export async function notificationsEnabled(): Promise<boolean> {
  // Web 无通知权限概念，视作已开启以免 UI 一直显示告警
  if (!NOTIFICATIONS_SUPPORTED) return true;
  try {
    const settings = await Notifications.getPermissionsAsync();
    return (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return true;
  }
}

/** 请求通知权限；已拒绝且不再询问时回落为打开设置页。 */
export async function requestNotifications(): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    if (!current.canAskAgain) {
      await openNotificationSettings();
      return false;
    }
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

/** 对应 legacy Perms.channelHigh：渠道重要性是否仍为高。 */
export async function channelHigh(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    await ensureChannel();
    const ch = await Notifications.getNotificationChannelAsync(CHANNEL_ID);
    if (!ch) return false;
    return (
      ch.importance === Notifications.AndroidImportance.HIGH ||
      ch.importance === Notifications.AndroidImportance.MAX
    );
  } catch {
    return true;
  }
}

/**
 * 精确闹钟权限（Android 12+）。
 *
 * expo-notifications 没有直接读取 SCHEDULE_EXACT_ALARM 的 API。
 * 这里通过"能否排出一条 1 秒后的精确通知"来间接判定不现实（会有副作用），
 * 因此改用说明性做法：无法回读时返回 undefined，由 UI 提示用户去系统设置确认。
 */
export async function exactAlarmsEnabled(): Promise<boolean | undefined> {
  if (Platform.OS !== 'android') return true;
  // 无法可靠回读，交由 UI 显示"请在系统设置中确认"
  return undefined;
}

/** 打开本应用的精确闹钟设置页（Android 12+）。 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // ACTION_REQUEST_SCHEDULE_EXACT_ALARM
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
      { data: `package:${PKG}` }
    );
  } catch {
    await openAppDetails();
  }
}

/** 打开通知设置。 */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync('android.settings.APP_NOTIFICATION_SETTINGS', {
      extra: { 'android.provider.extra.APP_PACKAGE': PKG },
    });
  } catch {
    await openAppDetails();
  }
}

/** 打开通知渠道设置（让用户把重要性调成「高」）。 */
export async function openChannelSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await openNotificationSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync('android.settings.CHANNEL_NOTIFICATION_SETTINGS', {
      extra: {
        'android.provider.extra.APP_PACKAGE': PKG,
        'android.provider.extra.CHANNEL_ID': CHANNEL_ID,
      },
    });
  } catch {
    await openNotificationSettings();
  }
}

/** 请求忽略电池优化（Android 6+）。 */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: `package:${PKG}` }
    );
  } catch {
    await openAppDetails();
  }
}

/** 打开勿扰模式设置。 */
export async function openDndSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync('android.settings.ZEN_MODE_SETTINGS');
  } catch {
    await Linking.openSettings();
  }
}

/** 打开应用详情页（厂商自启动等入口的兜底）。 */
export async function openAppDetails(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
      data: `package:${PKG}`,
    });
  } catch {
    await Linking.openSettings();
  }
}

/** 主题色常量，供 UI 复用。 */
export const PRIMARY_COLOR = COLORS.primary.light;
