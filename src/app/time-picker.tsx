import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Icon } from '@/components/ui/Icon';
import { Medium, TextMuted } from '@/components/ui/Text';
import { formatTime } from '@/lib/format';
import { useFirstAt } from '@/lib/firstAt';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';
import { goBack } from '@/lib/nav';

type Mode = 'first' | 'backfill' | 'special-backfill';

/**
 * 时间选择页。对应 legacy TimeSheet.java。
 *
 * 三种用途：
 * - first：今日第一次服药时间（Hero 里的「修改」）
 * - backfill：补登第 N 次实际服药时间
 * - special-backfill：补登特殊用药实际时间
 */
export default function TimePickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const params = useLocalSearchParams<{ mode?: string; index?: string; id?: string }>();
  const mode = (params.mode ?? 'first') as Mode;
  const index = params.index != null ? Number(params.index) : -1;
  const specialId = params.id ?? '';

  const cycle = useStore((s) => s.cycle);
  const specials = useStore((s) => s.specials);
  const markTakenAt = useStore((s) => s.markTakenAt);
  const markSpecialTaken = useStore((s) => s.markSpecialTaken);

  const special = useMemo(
    () => specials.find((m) => m.id === specialId),
    [specials, specialId]
  );

  // 初始时间：补登取「当前时间与计划时间中较早者」
  const initial = useMemo(() => {
    const now = Date.now();
    if (mode === 'backfill' && cycle && index >= 0 && index < cycle.count) {
      const planned = cycle.planned[index] > 0 ? cycle.planned[index] : now;
      return new Date(Math.min(now, planned));
    }
    if (mode === 'special-backfill' && special) {
      const due = special.snoozeUntil > 0 ? special.snoozeUntil : special.nextAt;
      return new Date(Math.min(now, due > 0 ? due : now));
    }
    return new Date(now);
  }, [mode, cycle, index, special]);

  const [picked, setPicked] = useState<Date>(initial);

  const meta = useMemo(() => {
    if (mode === 'backfill') {
      return {
        title: `补登第${index + 1}次服药`,
        intro: '如果已经服过药但忘记登记，在这里选择实际服用的时间。',
        hint: '只能选择过去的时间；补登后下一次会从实际时间 + 间隔重排。',
      };
    }
    if (mode === 'special-backfill') {
      return {
        title: `补登 ${special?.name ?? ''}`,
        intro: '选择这次实际服用的时间，下一次会按这个时间重新计算。',
        hint: '只能选择过去的时间；补登后会同步更新提醒。',
      };
    }
    return {
      title: '第一次服药时间',
      intro: '选择今天第一次服药的时间，之后会按这个时间自动安排提醒。',
      hint: '只能选择今天已经过去的时间；如果记不清，保持默认的当前时间也可以。',
    };
  }, [mode, index, special]);

  const confirm = useCallback(async () => {
    const at = picked.getTime();
    const now = Date.now();

    if (at > now + 30_000) {
      Alert.alert('提示', '时间不能晚于现在');
      return;
    }

    if (mode === 'backfill') {
      if (!cycle || index < 0 || index >= cycle.count) {
        goBack();
        return;
      }
      // 不能早于上一次服药时间
      let previous = 0;
      for (let j = index - 1; j >= 0; j--) {
        if (cycle.status[j] === 1) {
          previous = cycle.actedAt[j];
          break;
        }
      }
      if (previous > 0 && at < previous) {
        Alert.alert('提示', '补登时间不能早于上一次服药时间');
        return;
      }
      markTakenAt(index, at);
      await syncAll(buildSchedulerInput());
      goBack();
      return;
    }

    if (mode === 'special-backfill') {
      if (!special) {
        goBack();
        return;
      }
      if (special.lastAt > 0 && at < special.lastAt) {
        Alert.alert('提示', '补登时间不能早于上次服药时间');
        return;
      }
      markSpecialTaken(special.id, at);
      await syncAll(buildSchedulerInput());
      goBack();
      return;
    }

    // 'first' 模式：写回共享状态，由今日页读取
    useFirstAt.getState().set(at);
    goBack();
  }, [picked, mode, cycle, index, special, markTakenAt, markSpecialTaken, router]);

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

        <TextMuted className="mt-3 text-[11.5px] leading-[16px]">{meta.hint}</TextMuted>

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
