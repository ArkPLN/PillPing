import React, { useCallback } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { SpecialCard } from '@/components/special/SpecialCard';
import { AddMoreButton, EmptyState, InfoBanner } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { TextMuted } from '@/components/ui/Text';
import { useNow } from '@/lib/useNow';
import { useTheme } from '@/lib/theme';
import { useStore } from '@/store/useStore';
import { useRouter } from 'expo-router';
import { effectiveAt } from '@/lib/specialmed';

import { resyncNotifications } from '@/lib/useHomeActions';

/**
 * 特殊用药页。对应 legacy MainActivity.buildSpecial()。
 */
export default function SpecialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(1000);
  const { color } = useTheme();

  const specials = useStore((s) => s.specials);
  const toggleSpecialEnabled = useStore((s) => s.toggleSpecialEnabled);
  const markSpecialTaken = useStore((s) => s.markSpecialTaken);
  const snoozeSpecial = useStore((s) => s.snoozeSpecial);

  const openNew = useCallback(() => {
    router.push({ pathname: '/special-form', params: { id: '' } });
  }, [router]);

  const openEdit = useCallback(
    (id: string) => {
      router.push({ pathname: '/special-form', params: { id } });
    },
    [router]
  );

  const onTake = useCallback(
    async (id: string, recordKey: string, name: string) => {
      markSpecialTaken(id, recordKey);
      await resyncNotifications();
      Alert.alert('已记录', `已记录 ${name}`);
    },
    [markSpecialTaken]
  );

  const onSnooze = useCallback(
    async (id: string, recordKey: string) => {
      snoozeSpecial(id, recordKey, 10);
      await resyncNotifications();
      Alert.alert('已推迟', '将在 10 分钟后提醒');
    },
    [snoozeSpecial]
  );

  const onBackfill = useCallback(
    (id: string, due: number) => {
      router.push({
        pathname: '/time-picker',
        params: { mode: 'special-backfill', id, due: String(due) },
      });
    },
    [router]
  );

  const onToggle = useCallback(
    async (id: string, name: string, enabled: boolean) => {
      toggleSpecialEnabled(id);
      await resyncNotifications();
      Alert.alert(enabled ? '已启用' : '已停用', `${enabled ? '已启用' : '已停用'} ${name}`);
    },
    [toggleSpecialEnabled]
  );

  return (
    <ScrollView
      className="flex-1 bg-bg dark:bg-bg-d"
      contentContainerClassName="px-5 pb-7"
      contentContainerStyle={{ paddingTop: insets.top }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="特殊用药"
        subtitle="一次性、每周计数或指定日期，不参与今日计划"
        action={
          <HeaderIconButton accessibilityLabel="添加特殊用药" onPress={openNew} tone="violet">
            <Icon name="add" size={21} color="#FFFFFF" />
          </HeaderIconButton>
        }
      />

      <View className="mt-3.5">
        <InfoBanner
          icon="clock"
          tone="violet"
          text="适合一次性、每周 N 次或指定日期等不规则用药；与普通药物分开提醒。"
        />
      </View>

      {specials.length === 0 ? (
        <View className="mt-4">
          <EmptyState
            icon="clock"
            title="还没有特殊用药"
            desc={'如果某种药不按普通方案服用，\n可以在这里单独设置它的提醒节奏。'}
            buttonLabel="添加特殊用药"
            buttonTone="violet"
            onAdd={openNew}
          />
        </View>
      ) : (
        <View className="mt-4 gap-2.5">
          {specials.map((m) => (
            <SpecialCard
              key={m.id}
              med={m}
              now={now}
              onPress={() => openEdit(m.id)}
              onToggle={(v) => onToggle(m.id, m.name, v)}
              onTake={(recordKey) => onTake(m.id, recordKey, m.name)}
              onBackfill={(recordKey) => onBackfill(m.id, effectiveAt(m))}
              onSnooze={(recordKey) => onSnooze(m.id, recordKey)}
            />
          ))}
          <View className="mt-1">
            <AddMoreButton label="＋  添加特殊用药" tone="violet" onPress={openNew} />
          </View>
        </View>
      )}

      <TextMuted className="mt-5 text-center text-[11.5px] leading-[16px]">
        特殊用药独立提醒，不会影响「今日」的服药次数和间隔。
      </TextMuted>
    </ScrollView>
  );
}
