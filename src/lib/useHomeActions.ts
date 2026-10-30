import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

import { nextPending } from '@/lib/cycle';
import { useFirstAt } from '@/lib/firstAt';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';
import { useRouter } from 'expo-router';

/** 立即同步通知。所有改动状态的操作后都要调用。 */
export async function resyncNotifications(): Promise<void> {
  await syncAll(buildSchedulerInput());
}

/**
 * 今日页的交互集合。对应 legacy MainActivity 里
 * startCycle / markNextTaken / snoozeNext / showBackfill 等方法。
 */
export function useHomeActions() {
  const router = useRouter();
  const store = useStore();
  const firstAt = useFirstAt((s) => s.firstAt);
  const ensureFirstAt = useFirstAt((s) => s.ensure);
  
  // 跨天后重算默认的"第一次服药时间"。对应 legacy ensureFirstAtChoice()。
  useEffect(() => {
    ensureFirstAt();
  }, [ensureFirstAt]);

  /** 打开时间选择（第一次服药时间）。 */
  const pickFirstTime = useCallback(() => {
    router.push({ pathname: '/time-picker', params: { mode: 'first' } });
  }, [router]);

  /** 记录第一次服药并开始计时。对应 legacy startCycle()。 */
  const startCycle = useCallback(async () => {
    const now = Date.now();
    const first = Math.min(firstAt, now);
    store.startCycle(first, store.interval, store.doseCount);

    const s = useStore.getState();
    if (s.meds.length === 0) {
      Alert.alert('提醒已设定', '建议到「药物」页添加药品');
    } else if (s.cycle && s.cycle.count > 1) {
      const t = s.cycle.planned[1];
      const d = new Date(t);
      Alert.alert(
        '提醒已设定',
        `下一次提醒：${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      );
    } else {
      Alert.alert('已完成', '已记录今天的服药');
    }

    await resyncNotifications();
  }, [firstAt, store]);

  /** 记录下一次服药。对应 legacy markNextTaken()（含提前服用二次确认）。 */
  const markNextTaken = useCallback(async () => {
    const c = useStore.getState().cycle;
    if (!c) return;
    const next = nextPending(c);
    if (next < 0) return;

    const planned = c.planned[next];
    if (planned - Date.now() > 30 * 60_000) {
      const d = new Date(planned);
      Alert.alert(
        '还没到服药时间',
        `计划时间是 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}，确定现在就记录为已服用吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '现在记录',
            onPress: async () => {
              useStore.getState().markTaken(next);
              await resyncNotifications();
            },
          },
        ]
      );
      return;
    }

    useStore.getState().markTaken(next);
    await resyncNotifications();
  }, []);

  /** 推迟下一次 10 分钟。对应 legacy snoozeNext()。 */
  const snoozeNext = useCallback(async () => {
    const c = useStore.getState().cycle;
    if (!c) return;
    const next = nextPending(c);
    if (next < 0) return;

    useStore.getState().snooze(next, 10);
    await resyncNotifications();
  }, []);

  /** 补登下一次实际服药时间。 */
  const backfillNext = useCallback(() => {
    const c = useStore.getState().cycle;
    if (!c) return;
    const next = nextPending(c);
    if (next < 0) return;
    router.push({ pathname: '/time-picker', params: { mode: 'backfill', index: String(next) } });
  }, [router]);

  /** 打开某次服药详情。 */
  const openDose = useCallback(
    (index: number) => {
      router.push({ pathname: '/dose', params: { index: String(index) } });
    },
    [router]
  );

  return {
    firstAt,
    pickFirstTime,
    startCycle,
    markNextTaken,
    snoozeNext,
    backfillNext,
    openDose,
  };
}

