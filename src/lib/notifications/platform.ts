import { Platform } from 'react-native';

/**
 * expo-notifications 的原生能力在 Web 上不可用。
 *
 * 具体表现：`getLastNotificationResponseAsync`、渠道相关 API 等在 web 会抛
 * "not available on web" 的 UnavailabilityError；事件订阅则静默无效。
 *
 * 本应用的目标平台是 Android，Web 只用于开发期预览，
 * 因此这里统一在 web 上把通知层降级为 no-op，避免整页白屏。
 */

export const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web';

/**
 * 在不受支持的平台上安全执行通知操作。
 * 失败时仅告警，不向上抛出，确保 UI 不会被通知错误打断。
 */
export async function safeNotify<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  if (!NOTIFICATIONS_SUPPORTED) return undefined;
  try {
    return await fn();
  } catch (err) {
    if (__DEV__) {
      console.warn(`[notifications] ${label} failed:`, err);
    }
    return undefined;
  }
}
