import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { HistoryList, MedsShortcut, SectionHeader } from '@/components/home/HomeCards';
import { HomeHeader } from '@/components/home/Header';
import { TimelineCard, TimelineProgress } from '@/components/home/TimelineCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextMuted } from '@/components/ui/Text';
import { isCourseActive } from '@/lib/med';
import { todayKey } from '@/lib/format';
import { aggregateDay } from '@/lib/timeline';
import { useHomeActions } from '@/lib/useHomeActions';
import { useNow } from '@/lib/useNow';
import { buildHistory, useStore } from '@/store/useStore';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const meds = useStore((s) => s.meds);
  const records = useStore((s) => s.records);
  const remindersEnabled = useStore((s) => s.remindersEnabled);
  const useStreak = useStore((s) => s.useStreak);

  const dayKey = todayKey();
  const now = useNow(30_000);
  const agg = useMemo(() => aggregateDay(meds, records, dayKey, now), [meds, records, dayKey, now]);
  const history = useMemo(() => buildHistory(meds, records), [meds, records]);
  const { openDose } = useHomeActions();

  const activeCount = meds.filter((m) => m.enabled && isCourseActive(m, now)).length;
  const nextIndex = agg.entries.findIndex((e) => e.status === 'pending' || e.status === 'missed');

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader
          useStreak={useStreak}
          remindersEnabled={remindersEnabled}
          onSettings={() => router.push('/settings')}
        />

        {agg.total > 0 ? (
          <TimelineProgress taken={agg.taken} total={agg.total} />
        ) : (
          <EmptyState
            icon="pill"
            title="今天没有服药计划"
            desc={
              meds.length === 0
                ? '添加药物并设置服药时间后，这里会显示今天的安排。'
                : '今天没有安排；可以在药物页调整计划。'
            }
            buttonLabel={meds.length === 0 ? '添加药物' : '管理药物'}
            buttonTone="primary"
            onAdd={() => router.push('/meds')}
          />
        )}

        {agg.total > 0 ? (
          <>
            <SectionHeader title="今天的服药" trailing={`${agg.taken}/${agg.total} 已服`} />
            {agg.entries.map((entry, index) => (
              <TimelineCard
                key={`${entry.medId}-${entry.slotKey}-${entry.dateKey}`}
                entry={entry}
                now={now}
                isNext={index === nextIndex}
                onPress={() => openDose(entry)}
              />
            ))}
          </>
        ) : null}

        <MedsShortcut
          total={meds.length}
          active={activeCount}
          onPress={() => router.push('/meds')}
        />

        {history.length > 0 ? (
          <>
            <SectionHeader title="最近记录" />
            <HistoryList history={history} />
          </>
        ) : null}

        <TextMuted className="mt-4 text-[11px] leading-[16px]">
          本应用仅作服药提醒，不构成医疗建议；用药请遵医嘱。
        </TextMuted>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}
