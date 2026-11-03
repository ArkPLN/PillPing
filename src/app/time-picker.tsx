import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Icon } from '@/components/ui/Icon';
import { Medium, TextMuted } from '@/components/ui/Text';
import { formatTime } from '@/lib/format';
import { projectDay } from '@/lib/plan';
import { recordKeyFor } from '@/lib/specialmed';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';
import { goBack } from '@/lib/nav';

type Mode = 'backfill' | 'special-backfill';

/**
 * 时间选择页：补登实际服用时刻。
 * - backfill：普通药（medId + slotKey + dateKey）
 * - special-backfill：特殊用药（id + due/recordKey）
 */
export default function TimePickerScreen() {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const params = useLocalSearchParams<{
    mode?: string;
    medId?: string;
    slotKey?: string;
    dateKey?: string;
    id?: string;
    due?: string;
    recordKey?: string;
  }>();
  const mode = (params.mode ?? 'backfill') as Mode;

  const meds = useStore((s) => s.meds);
  const records = useStore((s) => s.records);
  const specials = useStore((s) => s.specials);
  const markTakenAt = useStore((s) => s.markTakenAt);
  const markSpecialTaken = useStore((s) => s.markSpecialTaken);

  const special = useMemo(
    () => specials.find((m) => m.id === params.id),
    [specials, params.id]
  );

  const med = useMemo(
    () => meds.find((m) => m.id === params.medId),
    [meds, params.medId]
  );

  const entry = useMemo(() => {
    if (mode !== 'backfill' || !med || !params.slotKey || !params.dateKey) return undefined;
    return projectDay(med, records, params.dateKey).find((e) => e.slotKey === params.slotKey);
  }, [mode, med, records, params.slotKey, params.dateKey]);

  const initial = useMemo(() => {
    const now = Date.now();
    if (mode === 'backfill' && entry) {
      return new Date(Math.min(now, entry.plannedAt || now));
    }
    if (mode === 'special-backfill' && special) {
      const due = Number(params.due) || special.nextAt;
      return new Date(Math.min(now, due > 0 ? due : now));
    }
    return new Date(now);
  }, [mode, entry, special, params.due]);

  const [picked, setPicked] = useState<Date>(initial);

  const meta = useMemo(() => {
    if (mode === 'backfill') {
      return {
        title: `补登 ${med?.name ?? ''}`,
        intro: '选择实际服用的时间，下一次会按这个时间重新计算。',
      };
    }
    return {
      title: `补登 ${special?.name ?? ''}`,
      intro: '选择这次实际使用的时间，下一次会按这个时间重新计算。',
    };
  }, [mode, med, special]);

  const confirm = useCallback(async () => {
    const at = picked.getTime();
    if (at > Date.now() + 30_000) {
      Alert.alert('提示', '时间不能晚于现在');
      return;
    }

    if (mode === 'backfill') {
      if (!med || !params.slotKey || !params.dateKey) {
        goBack();
        return;
      }
      markTakenAt(med.id, params.slotKey, params.dateKey, at);
      await syncAll(buildSchedulerInput());
      goBack();
      return;
    }

    if (!special) {
      goBack();
      return;
    }
    const due = Number(params.due) || special.nextAt;
    const key = params.recordKey || (due > 0 ? recordKeyFor(due) : '');
    markSpecialTaken(special.id, key, at);
    await syncAll(buildSchedulerInput());
    goBack();
  }, [picked, mode, med, special, params, markTakenAt, markSpecialTaken]);

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={meta.title}
          subtitle={meta.intro}
          action={
            <HeaderIconButton accessibilityLabel="关闭" onPress={() => goBack()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        <View className="mt-4 overflow-hidden rounded-[18px] border border-line bg-card dark:border-line-d dark:bg-card-d">
          <DateTimePicker
            value={picked}
            mode="time"
            is24Hour
            display="spinner"
            onChange={(_, date) => {
              if (date) setPicked(date);
            }}
          />
        </View>

        <TextMuted className="mt-3 text-[11.5px] leading-[16px]">
          只能选择过去的时间；补登后会同步更新提醒。
        </TextMuted>

        <View className="mt-5 flex-row items-center gap-2">
          <View className="flex-1" />
          <Pressable onPress={() => goBack()} className="px-3 py-3 active:opacity-70">
            <TextMuted className="text-[14px]">取消</TextMuted>
          </Pressable>
          <Pressable
            onPress={confirm}
            className="w-[112px] items-center rounded-2xl bg-primary py-3 active:opacity-80 dark:bg-primary-d"
          >
            <Text className="text-[15px] font-bold text-white dark:text-on-bright-d">确定</Text>
          </Pressable>
        </View>

        <View className="mt-4 rounded-2xl bg-mint p-3.5 dark:bg-mint-d">
          <Medium className="text-[12.5px]">已选择 {formatTime(picked.getTime())}</Medium>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}
