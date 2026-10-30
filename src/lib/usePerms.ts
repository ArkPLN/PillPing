import { useCallback, useEffect, useState } from 'react';

import { channelHigh, notificationsEnabled } from '@/lib/perms';

export type PermSnapshot = {
  notifications: boolean;
  channelHigh: boolean;
  exactAlarms: boolean | undefined;
};

/**
 * 读取权限状态。对应 legacy SettingsSheet / GuideSheet 里对 Perms 的多次同步调用，
 * 这里集中成一次异步快照，并在回到页面时刷新。
 */
export function usePerms(refreshKey = 0) {
  const [snap, setSnap] = useState<PermSnapshot>({
    notifications: true,
    channelHigh: true,
    exactAlarms: undefined,
  });

  const refresh = useCallback(async () => {
    const [n, ch, ex] = await Promise.all([
      notificationsEnabled().catch(() => false),
      channelHigh().catch(() => true),
      import('@/lib/perms').then((m) => m.exactAlarmsEnabled()).catch(() => undefined),
    ]);
    setSnap({ notifications: n, channelHigh: ch, exactAlarms: ex });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return { ...snap, refresh };
}
