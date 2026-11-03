import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageHeader, HeaderIconButton } from '@/components/home/Header';
import { MedCard } from '@/components/meds/MedCard';
import { AddMoreButton, EmptyState, InfoBanner } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { TextMuted } from '@/components/ui/Text';
import { isCourseActive } from '@/lib/med';
import { useNow } from '@/lib/useNow';
import { useTheme } from '@/lib/theme';
import { useStore } from '@/store/useStore';
import { useRouter } from 'expo-router';

/**
 * 药物页。
 */
export default function MedsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
  const { color } = useTheme();

  const meds = useStore((s) => s.meds);
  const toggleMedEnabled = useStore((s) => s.toggleMedEnabled);

  const openNew = useCallback(() => {
    router.push({ pathname: '/med-form', params: { id: '' } });
  }, [router]);

  const openEdit = useCallback(
    (id: string) => {
      router.push({ pathname: '/med-form', params: { id } });
    },
    [router]
  );

  const activeCount = useMemo(
    () => meds.filter((m) => m.enabled && isCourseActive(m, now)).length,
    [meds, now]
  );

  return (
    <ScrollView
      className="flex-1 bg-bg dark:bg-bg-d"
      contentContainerClassName="px-5 pb-7"
      contentContainerStyle={{ paddingTop: insets.top }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="我的药物"
        subtitle="设置每次服用的药名、用量和方式"
        action={
          <HeaderIconButton accessibilityLabel="添加药物" onPress={openNew}>
            <Icon name="add" size={21} color={color('primary')} />
          </HeaderIconButton>
        }
      />

      <View className="mt-3.5">
        <InfoBanner
          icon="pill"
          text="每种药可以设置独立的服药时间计划；停用后仍会保留在清单里。"
        />
      </View>

      {meds.length === 0 ? (
        <View className="mt-4">
          <EmptyState
            icon="pill"
            title="还没有添加药物"
            desc={'先添加你每天要吃的药，\n开始提醒时会自动带上药名、用量和方式。'}
            buttonLabel="添加第一种药"
            onAdd={openNew}
          />
        </View>
      ) : (
        <View className="mt-4 gap-2.5">
          {meds.map((m) => (
            <MedCard
              key={m.id}
              med={m}
              onPress={() => openEdit(m.id)}
              onToggle={(v) => toggleMedEnabled(m.id)}
            />
          ))}
          <View className="mt-1">
            <AddMoreButton label="＋  添加药物" onPress={openNew} />
          </View>
        </View>
      )}

      <TextMuted className="mt-5 text-center text-[11.5px] leading-[16px]">
        提醒内容按这里的最新设置生成；修改后无需重新开始计时。
      </TextMuted>
    </ScrollView>
  );
}
