import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DoseCard, HistoryList, MedsShortcut, PlanPlaceholder, SectionHeader } from '@/components/home/HomeCards';
import { HomeHeader } from '@/components/home/Header';
import { ActiveHero, DoneHero, StartHero } from '@/components/home/Hero';
import { PrimaryButton } from '@/components/ui/Button';
import { Bold, TextMuted } from '@/components/ui/Text';
import { allResolved, isStarted, nextPending } from '@/lib/cycle';
import { shouldStartNewDay } from '@/lib/day';
import { useNow } from '@/lib/useNow';
import { activeMedCount } from '@/lib/med';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';
import { useRouter } from 'expo-router';

import { useHomeActions } from '@/lib/useHomeActions';

/**
 * 今日页。对应 legacy MainActivity.buildHome()。
 */
export default function HomeScreen() {
  const router = useRouter();
  const now = useNow(1000);
  const insets = useSafeAreaInsets();

  const store = useStore();
  const { cycle, meds, interval, doseCount, remindersEnabled, useStreak, history } = store;

  const actions = useHomeActions();

  const start = useMemo(() => shouldStartNewDay(cycle, now), [cycle, now]);
  const done = !!cycle && isStarted(cycle) && allResolved(cycle);
  const planCount = start ? doseCount : cycle && isStarted(cycle) ? cycle.count : doseCount;

  return (
    <ScrollView
      className="flex-1 bg-bg dark:bg-bg-d"
      contentContainerClassName="px-5 pb-7"
      contentContainerStyle={{ paddingTop: insets.top }}
      showsVerticalScrollIndicator={false}
    >
      <HomeHeader
        useStreak={useStreak}
        remindersEnabled={remindersEnabled}
        onSettings={() => router.push('/settings')}
      />

      <View className="mt-3.5">
        {start ? (
          <StartHero
            interval={interval}
            doseCount={doseCount}
            firstAt={actions.firstAt}
            medCount={meds.length}
            previous={cycle}
            onPickTime={actions.pickFirstTime}
            onStart={actions.startCycle}
            onGoMeds={() => router.push('/meds')}
          />
        ) : done ? (
          <DoneHero cycle={cycle!} />
        ) : (
          <ActiveHero
            cycle={cycle!}
            meds={meds}
            now={now}
            onTake={actions.markNextTaken}
            onSnooze={actions.snoozeNext}
            onBackfill={actions.backfillNext}
            onGoMeds={() => router.push('/meds')}
          />
        )}
      </View>

      <View className="mt-6">
        <SectionHeader title="今天的服药计划" trailing={`${planCount} 次 · ${interval} 小时`} />
      </View>

      {start ? (
        <PlanPlaceholder doseCount={doseCount} interval={interval} />
      ) : (
        <View className="gap-2.5">
          {Array.from({ length: planCount }).map((_, i) => (
            <DoseCard
              key={i}
              cycle={cycle!}
              index={i}
              meds={meds}
              now={now}
              onPress={() => actions.openDose(i)}
            />
          ))}
        </View>
      )}

      <View className="mt-4">
        <MedsShortcut
          total={meds.length}
          active={activeMedCount(meds, now)}
          onPress={() => router.push('/meds')}
        />
      </View>

      {history.length > 0 && (
        <View className="mt-6.5">
          <SectionHeader title="最近记录" trailing={null} />
          <HistoryList history={history} />
        </View>
      )}

      <Text className="mt-6.5 text-center text-[11px] leading-[15px] text-muted-light dark:text-muted-light-d">
        本应用仅用于服药时间提醒，不提供医疗建议。{'\n'}具体用药请遵医嘱。
      </Text>
    </ScrollView>
  );
}
