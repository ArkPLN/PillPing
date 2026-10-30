/**
 * 通知生命周期管理。
 *
 * 职责：
 * 1. 首次挂载时初始化渠道/类目/前台处理器
 * 2. 应用回到前台时重新同步通知（兜底：系统清理、时区变更、强制停止后恢复）
 * 3. 订阅通知响应（前台点击 action 按钮）
 *
 * 对应 legacy 的 BootReceiver（开机/时区变更恢复）+ MainActivity.onCreate
 * 里的 scheduleAll 调用。
 */

import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { initNotifications } from './channel';
import { buildSchedulerInput } from './input';
import { handleNotificationResponse } from './response';
import { syncAll } from './scheduler';

export function useNotificationLifecycle() {
  const lastSync = useRef(0);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await initNotifications();
      if (!mounted) return;
      await syncAll(buildSchedulerInput());
      lastSync.current = Date.now();
    })();

    // 前台点击按钮时也会走到这里（后台冷启动由 routing 层处理）
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      await handleNotificationResponse(response);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const onChange = async (state: AppStateStatus) => {
      if (state !== 'active') return;
      // 回前台时间隔太近就不重复同步，避免无谓的通知重建
      if (Date.now() - lastSync.current < 1500) return;
      await syncAll(buildSchedulerInput());
      lastSync.current = Date.now();
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
}

/**
 * 处理应用被通知点击「冷启动」的情况。
 * expo-notifications 在进程被杀后，响应会通过 getLastNotificationResponseAsync 取到。
 */
export async function consumeInitialResponse(): Promise<boolean> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return false;
  return handleNotificationResponse(response);
}
