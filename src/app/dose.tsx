import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmDialog } from '@/components/forms/Dialogs';
import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Bold, Medium, TextMuted } from '@/components/ui/Text';
import { planSummary, slotTimeText } from '@/lib/med';
import { slotDose } from '@/lib/plan';
import { formatDose, UNITS } from '@/lib/units';
import { formatMonthDay, formatTime } from '@/lib/format';
import { projectDay } from '@/lib/plan';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';
import { goBack } from '@/lib/nav';
import { BACKFILL_CONFIRM_AFTER_MS } from '@/constants/thresholds';

/** 单次服药详情。 */
export default function DoseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const params = useLocalSearchParams<{ medId?: string; slotKey?: string; dateKey?: string }>();
  const meds = useStore((s) => s.meds);
  const records = useStore((s) => s.records);
  const markTaken = useStore((s) => s.markTaken);
  const skip = useStore((s) => s.skip);
  const undo = useStore((s) => s.undo);
  const snooze = useStore((s) => s.snooze);

  const [confirmSkip, setConfirmSkip] = useState(false);

  const med = useMemo(() => meds.find((m) => m.id === params.medId), [meds, params.medId]);
  const entry = useMemo(() => {
    if (!med || !params.slotKey || !params.dateKey) return undefined;
    return projectDay(med, records, params.dateKey).find((e) => e.slotKey === params.slotKey);
  }, [med, records, params.slotKey, params.dateKey]);

  const valid = !!med && !!entry;
  const status = entry?.status ?? 'pending';
  const dose = med && entry?.slot ? slotDose(med, entry.slot) : med ? { qty: med.doseQty, unit: med.doseUnit } : { qty: '', unit: UNITS[0] };

  const doTake = useCallback(async () => {
    if (!med || !entry) return;
    const run = async () => {
      markTaken(med.id, entry.slotKey, entry.dateKey);
      await syncAll(buildSchedulerInput());
      goBack();
    };
    if (entry.plannedAt - Date.now() > BACKFILL_CONFIRM_AFTER_MS) {
      Alert.alert(
        '还没到服药时间',
        `计划时间是 ${formatTime(entry.plannedAt)}，确定现在就记录为已服用吗？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '现在记录', onPress: run },
        ]
      );
      return;
    }
    await run();
  }, [med, entry, markTaken]);

  const doSnooze = useCallback(async () => {
    if (!med || !entry) return;
    snooze(med.id, entry.slotKey, entry.dateKey, 10);
    await syncAll(buildSchedulerInput());
    goBack();
  }, [med, entry, snooze]);

  const doSkip = useCallback(async () => {
    if (!med || !entry) return;
    setConfirmSkip(false);
    skip(med.id, entry.slotKey, entry.dateKey);
    await syncAll(buildSchedulerInput());
    goBack();
  }, [med, entry, skip]);

  const doUndo = useCallback(async () => {
    if (!med || !entry) return;
    undo(med.id, entry.slotKey, entry.dateKey);
    await syncAll(buildSchedulerInput());
    goBack();
  }, [med, entry, undo]);

  const goBackfill = useCallback(() => {
    if (!med || !entry) return;
    router.push({
      pathname: '/time-picker',
      params: {
        mode: 'backfill',
        medId: med.id,
        slotKey: entry.slotKey,
        dateKey: entry.dateKey,
      },
    });
  }, [router, med, entry]);

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title="本次服药"
          subtitle={med ? `${med.name} · ${planSummary(med)}` : ''}
          action={
            <HeaderIconButton accessibilityLabel="关闭" onPress={() => goBack()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        {valid && entry && med ? (
          <>
            <View className="mt-4 rounded-[18px] border border-line bg-card p-4 dark:border-line-d dark:bg-card-d">
              <View className="flex-row items-center justify-between">
                <Bold className="text-[26px] tabular-nums text-ink dark:text-ink-d">
                  {formatTime(entry.due)}
                </Bold>
                {status === 'taken' ? <Pill>已服</Pill> : null}
                {status === 'pending' ? <Pill tone="muted">待服</Pill> : null}
                {status === 'missed' ? <Pill tone="amber">已漏服</Pill> : null}
                {status === 'skipped' ? <Pill tone="muted">已跳过</Pill> : null}
              </View>
              <TextMuted className="mt-1 text-[12px]">
                {formatMonthDay(entry.due)} · 计划 {formatTime(entry.plannedAt)}
              </TextMuted>
              <View className="mt-3 flex-row items-center gap-2">
                <Medium className="text-[14px]">
                  {formatDose(dose.qty, dose.unit)}
                </Medium>
                <TextMuted className="text-[12px]">{med.method}</TextMuted>
              </View>
              {entry.slot?.label ? (
                <TextMuted className="mt-1 text-[11.5px]">{entry.slot.label}</TextMuted>
              ) : null}
            </View>

            <View className="mt-4 gap-2">
              {status === 'pending' || status === 'missed' ? (
                <>
                  <Pressable
                    onPress={doTake}
                    className="items-center rounded-2xl bg-primary py-3.5 active:opacity-80 dark:bg-primary-d"
                  >
                    <Text className="text-[15px] font-bold text-white dark:text-on-bright-d">
                      记录本次已服
                    </Text>
                  </Pressable>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={doSnooze}
                      className="flex-1 items-center rounded-2xl border border-line bg-card py-3 active:opacity-70 dark:border-line-d dark:bg-card-d"
                    >
                      <Text className="text-[13px] text-ink dark:text-ink-d">推迟 10 分钟</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setConfirmSkip(true)}
                      className="flex-1 items-center rounded-2xl border border-line bg-card py-3 active:opacity-70 dark:border-line-d dark:bg-card-d"
                    >
                      <Text className="text-[13px] text-ink dark:text-ink-d">跳过本次</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={goBackfill}
                    className="items-center rounded-2xl border border-line bg-card py-3 active:opacity-70 dark:border-line-d dark:bg-card-d"
                  >
                    <Text className="text-[13px] text-primary dark:text-primary-d">
                      补登实际服用时间
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={doUndo}
                  className="items-center rounded-2xl border border-line bg-card py-3 active:opacity-70 dark:border-line-d dark:bg-card-d"
                >
                  <Text className="text-[13px] text-primary dark:text-primary-d">撤销本次记录</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <TextMuted className="mt-6 text-[13px]">未找到这次服药记录。</TextMuted>
        )}

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

      <ConfirmDialog
        visible={confirmSkip}
        title="跳过本次"
        message="跳过不会影响其他时间的服药计划。"
        positiveLabel="跳过"
        onCancel={() => setConfirmSkip(false)}
        onConfirm={doSkip}
      />
    </View>
  );
}
