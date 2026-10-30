import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmDialog } from '@/components/forms/Dialogs';
import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Bold, Medium, TextBody, TextMuted } from '@/components/ui/Text';
import { effectiveTime } from '@/lib/cycle';
import { formatDurationShort, formatMonthDay, formatTime } from '@/lib/format';
import { medsForSlot } from '@/lib/med';
import { medColor } from '@/lib/colors';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';
import { DOSE_PENDING, DOSE_SKIPPED, DOSE_TAKEN } from '@/lib/types';

/**
 * 单次服药详情。对应 legacy DoseSheet.java。
 */
export default function DoseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const params = useLocalSearchParams<{ index?: string }>();
  const index = params.index != null ? Number(params.index) : -1;

  const cycle = useStore((s) => s.cycle);
  const meds = useStore((s) => s.meds);
  const markTaken = useStore((s) => s.markTaken);
  const skip = useStore((s) => s.skip);
  const undo = useStore((s) => s.undo);
  const snooze = useStore((s) => s.snooze);

  const [confirmSkip, setConfirmSkip] = useState(false);

  const valid = !!cycle && index >= 0 && index < cycle.count;
  const status = valid ? cycle!.status[index] : DOSE_PENDING;
  const planned = valid ? cycle!.planned[index] : 0;
  const due = valid ? effectiveTime(cycle!, index) : 0;
  const now = Date.now();
  const list = useMemo(
    () => (valid ? medsForSlot(meds, index, now) : []),
    [valid, meds, index, now]
  );

  const doTake = useCallback(async () => {
    if (!valid) return;
    const plannedAt = cycle!.planned[index];
    const run = async () => {
      markTaken(index);
      await syncAll(buildSchedulerInput());
      router.back();
    };

    if (plannedAt - Date.now() > 30 * 60_000) {
      Alert.alert(
        '还没到服药时间',
        `计划时间是 ${formatTime(plannedAt)}，确定现在就记录为已服用吗？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '现在记录', onPress: run },
        ]
      );
      return;
    }
    await run();
  }, [valid, cycle, index, markTaken, router]);

  const doSnooze = useCallback(async () => {
    if (!valid) return;
    snooze(index, 10);
    await syncAll(buildSchedulerInput());
    router.back();
  }, [valid, index, snooze, router]);

  const doSkip = useCallback(async () => {
    if (!valid) return;
    setConfirmSkip(false);
    skip(index);
    await syncAll(buildSchedulerInput());
    router.back();
  }, [valid, index, skip, router]);

  const doUndo = useCallback(async () => {
    if (!valid) return;
    undo(index);
    await syncAll(buildSchedulerInput());
    router.back();
  }, [valid, index, undo, router]);

  const goBackfill = useCallback(() => {
    router.push({ pathname: '/time-picker', params: { mode: 'backfill', index: String(index) } });
  }, [router, index]);

  if (!valid) {
    return (
      <View className="flex-1 items-center justify-center bg-bg dark:bg-bg-d">
        <TextMuted>记录不存在</TextMuted>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-[14px] font-medium text-primary dark:text-primary-d">返回</Text>
        </Pressable>
      </View>
    );
  }

  let pill: React.ReactNode;
  if (status === DOSE_TAKEN) pill = <Pill>已服用</Pill>;
  else if (status === DOSE_SKIPPED) pill = <Pill tone="muted">已跳过</Pill>;
  else if (due <= now) pill = <Pill tone="danger">已超时</Pill>;
  else pill = <Pill>待服用</Pill>;

  const late = due <= now;
  const showOverdue = status === DOSE_PENDING && late;

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={`第${index + 1}次服药`}
          subtitle={`计划 ${formatMonthDay(planned)} · ${formatTime(planned)}${
            cycle!.snoozeUntil[index] > 0 ? ` · 已推迟到 ${formatTime(due)}` : ''
          }`}
          action={
            <HeaderIconButton accessibilityLabel="关闭" onPress={() => router.back()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        <View className="mt-2 flex-row items-center">
          <View className="flex-1" />
          {pill}
        </View>

        {/* 超时提示 */}
        {showOverdue && (
          <View className="mt-3.5 rounded-[14px] border border-amber-line bg-amber-bg p-3.5 dark:border-amber-line-d dark:bg-amber-bg-d">
            <Medium className="text-[12.5px] text-amber dark:text-amber-d">
              {late && now - due < 60_000
                ? '已到服药时间，请尽快服用'
                : `已超过计划时间 ${formatDurationShort(now - due)}`}
            </Medium>
            <TextMuted className="mt-1 text-[11.5px]">
              如果已经服过药，请直接记录；如果还没服，请尽快服用。
            </TextMuted>
          </View>
        )}

        {status === DOSE_PENDING && cycle!.snoozeUntil[index] > 0 && (
          <View className="mt-3.5 rounded-[14px] bg-mint p-3.5 dark:bg-mint-d">
            <Medium className="text-[12.5px] text-primary dark:text-primary-d">
              已推迟，将在 {formatTime(due)} 再次提醒
            </Medium>
          </View>
        )}

        {/* 本次药物 */}
        <Text className="mb-2 mt-5 text-[12.5px] font-medium text-primary dark:text-primary-d">
          本次药物
        </Text>

        {list.length === 0 ? (
          <View className="rounded-2xl border border-line bg-field p-4 dark:border-line-d dark:bg-field-d">
            <Medium className="text-[13.5px]">本次还没有配置药物</Medium>
            <TextMuted className="mt-1 text-[12px]">去「药物」页添加药名、用量和服用方式。</TextMuted>
            <Pressable
              onPress={() => router.replace('/meds')}
              className="mt-2 active:opacity-70"
            >
              <Text className="text-[13px] font-medium text-primary dark:text-primary-d">
                去添加药物 ›
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="overflow-hidden rounded-[18px] border border-line bg-card dark:border-line-d dark:bg-card-d">
            {list.map((m, i) => (
              <View key={m.id}>
                <View className="flex-row px-3.5 py-3">
                  <View
                    className="mt-1.5 h-[9px] w-[9px] rounded-full"
                    style={{ backgroundColor: medColor(m.color), marginRight: 11 }}
                  />
                  <View className="flex-1">
                    <Medium className="text-[14.5px]">{m.name}</Medium>
                    <TextMuted className="mt-0.5 text-[12px]">
                      {m.dose}  ·  {m.method}
                    </TextMuted>
                    {!!m.note && (
                      <TextMuted className="mt-0.5 text-[11.5px]">{m.note}</TextMuted>
                    )}
                  </View>
                </View>
                {i < list.length - 1 && <View className="h-px bg-line dark:bg-line-d" />}
              </View>
            ))}
          </View>
        )}

        {/* 操作 */}
        {status === DOSE_PENDING ? (
          <>
            <Pressable
              onPress={doTake}
              className="mt-5 items-center rounded-2xl bg-primary py-4 active:opacity-80 dark:bg-primary-d"
            >
              <Text className="text-[16px] font-bold text-white dark:text-on-bright-d">我已服用</Text>
            </Pressable>

            <Pressable
              onPress={doSnooze}
              className="mt-2.5 items-center rounded-2xl border border-line py-3 active:opacity-70 dark:border-line-d"
            >
              <Text className="text-[14px] font-medium text-ink-soft dark:text-ink-soft-d">
                10 分钟后再提醒
              </Text>
            </Pressable>

            <Pressable onPress={goBackfill} className="mt-3 py-2 active:opacity-70">
              <Text className="text-center text-[13px] font-medium text-primary dark:text-primary-d">
                忘记登记？补登实际服用时间 ›
              </Text>
            </Pressable>

            <Pressable onPress={() => setConfirmSkip(true)} className="mt-1 py-2 active:opacity-70">
              <Text className="text-center text-[13px] font-medium text-danger dark:text-danger-d">
                跳过这次
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View
              className={`mt-5 flex-row items-center rounded-[14px] p-3.5 ${
                status === DOSE_TAKEN ? 'bg-mint dark:bg-mint-d' : 'bg-field dark:bg-field-d'
              }`}
            >
              <Icon
                name={status === DOSE_TAKEN ? 'check' : 'close'}
                size={18}
                color={status === DOSE_TAKEN ? color('primary') : color('muted')}
              />
              <Medium
                className={`ml-2 flex-1 text-[12.5px] ${
                  status === DOSE_TAKEN
                    ? 'text-primary dark:text-primary-d'
                    : 'text-muted dark:text-muted-d'
                }`}
              >
                {status === DOSE_TAKEN
                  ? `已于 ${formatTime(cycle!.actedAt[index] > 0 ? cycle!.actedAt[index] : planned)} 记录服用`
                  : '这次已标记为跳过'}
              </Medium>
            </View>

            <Pressable onPress={goBackfill} className="mt-3.5 py-2 active:opacity-70">
              <Text className="text-center text-[13px] font-medium text-primary dark:text-primary-d">
                修改服用时间
              </Text>
            </Pressable>

            <Pressable onPress={doUndo} className="mt-1 py-2 active:opacity-70">
              <Text className="text-center text-[13px] font-medium text-muted dark:text-muted-d">
                撤销记录
              </Text>
            </Pressable>
          </>
        )}

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

      <ConfirmDialog
        visible={confirmSkip}
        title="跳过这次服药"
        message={`确定跳过第${index + 1}次服药吗？如果只是会晚一点，建议用「10 分钟后再提醒」。`}
        positiveLabel="跳过"
        onCancel={() => setConfirmSkip(false)}
        onConfirm={doSkip}
      />
    </View>
  );
}
