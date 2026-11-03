import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';

/** 立即同步通知。所有改动状态的操作后都要调用。 */
export async function resyncNotifications(): Promise<void> {
  await syncAll(buildSchedulerInput());
}

type DoseRef = { medId: string; slotKey: string; dateKey: string };

/**
 * 今日时间线的交互集合。
 */
export function useHomeActions() {
  const router = useRouter();

  const take = useCallback(async (ref: DoseRef) => {
    useStore.getState().markTaken(ref.medId, ref.slotKey, ref.dateKey);
    await resyncNotifications();
  }, []);

  const snooze = useCallback(async (ref: DoseRef) => {
    useStore.getState().snooze(ref.medId, ref.slotKey, ref.dateKey, 10);
    await resyncNotifications();
  }, []);

  const skip = useCallback(async (ref: DoseRef) => {
    useStore.getState().skip(ref.medId, ref.slotKey, ref.dateKey);
    await resyncNotifications();
  }, []);

  const backfill = useCallback(
    (ref: DoseRef) => {
      router.push({
        pathname: '/time-picker',
        params: {
          mode: 'backfill',
          medId: ref.medId,
          slotKey: ref.slotKey,
          dateKey: ref.dateKey,
        },
      });
    },
    [router]
  );

  const openDose = useCallback(
    (ref: DoseRef) => {
      router.push({
        pathname: '/dose',
        params: { medId: ref.medId, slotKey: ref.slotKey, dateKey: ref.dateKey },
      });
    },
    [router]
  );

  return { take, snooze, skip, backfill, openDose };
}
