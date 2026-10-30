import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Bold, Medium, TextMuted } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { effectiveTime } from '@/lib/cycle';
import {
  dateKeyToCn,
  dayLabel,
  formatDurationShort,
  formatMonthDay,
  formatTime,
} from '@/lib/format';
import { medsForSlot } from '@/lib/med';
import type { Cycle, HistoryItem, Med } from '@/lib/types';
import { DOSE_SKIPPED, DOSE_TAKEN } from '@/lib/types';
import { useTheme } from '@/lib/theme';

/** 单次服药卡片，对应 legacy buildDoseCard()。 */
export function DoseCard({
  cycle,
  index,
  meds,
  now,
  onPress,
}: {
  cycle: Cycle;
  index: number;
  meds: Med[];
  now: number;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const status = cycle.status[index];
  const isNext = cycle.status.findIndex((s) => s === 0) === index;
  const due = effectiveTime(cycle, index);
  const overdue = isNext && due <= now;

  let cardCls = 'border-line bg-card dark:border-line-d dark:bg-card-d';
  if (isNext) {
    cardCls = overdue
      ? 'border-amber-line bg-overdue-bg dark:border-amber-line-d dark:bg-overdue-bg-d'
      : 'border-primary bg-next-bg dark:border-primary-d dark:bg-next-bg-d';
  }

  const list = medsForSlot(meds, index, now);
  const day = dayLabel(due);

  let detail: string;
  let detailCls = 'text-muted-light dark:text-muted-light-d';
  if (status === DOSE_TAKEN) {
    detail = `已服用 ${formatTime(cycle.actedAt[index] > 0 ? cycle.actedAt[index] : due)}`;
    detailCls = 'text-primary dark:text-primary-d';
  } else if (status === DOSE_SKIPPED) {
    detail = '已跳过这次';
  } else if (cycle.snoozeUntil[index] > 0) {
    detail = `已推迟到 ${formatTime(due)}`;
    detailCls = 'text-amber dark:text-amber-d';
  } else if (due <= now) {
    const late = now - due;
    detail = late < 60_000 ? '已到服药时间' : `已超时 ${formatDurationShort(late)}`;
    detailCls = 'text-danger dark:text-danger-d';
  } else {
    detail = `计划 ${formatTime(due)}`;
  }

  let pill: React.ReactNode;
  if (status === DOSE_TAKEN) pill = <Pill>已服用</Pill>;
  else if (status === DOSE_SKIPPED)
    pill = (
      <Pill tone="muted">已跳过</Pill>
    );
  else if (isNext)
    pill = overdue ? <Pill tone="danger">该吃了</Pill> : <Pill>下次</Pill>;
  else pill = <Pill tone="muted">待服用</Pill>;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row rounded-[18px] border p-3.5 active:opacity-80 ${cardCls}`}
    >
      {/* 左侧：时间 + 序号 */}
      <View className="w-[52px]">
        {day !== '今天' && (
          <Text className="text-[9.5px] text-muted-light dark:text-muted-light-d">{day}</Text>
        )}
        <Bold
          className={`text-[15px] ${
            isNext
              ? overdue
                ? 'text-amber dark:text-amber-d'
                : 'text-primary dark:text-primary-d'
              : ''
          }`}
        >
          {formatTime(due)}
        </Bold>
        <TextMuted className="mt-0.5 text-[10.5px]">第{index + 1}次</TextMuted>
      </View>

      <View className="mr-3 w-px self-stretch bg-line dark:bg-line-d" />

      {/* 中间：药物清单 + 状态说明 */}
      <View className="flex-1">
        {list.length === 0 ? (
          <TextMuted className="text-[13px]">未配置药物</TextMuted>
        ) : (
          list.map((m, i) => (
            <View key={m.id} className={i > 0 ? 'mt-1' : ''}>
              <Text className="text-[13px] text-ink dark:text-ink-d">
                <Text className="font-bold">{m.name}</Text>
                {`  ${m.dose}`}
                <Text className="text-muted dark:text-muted-d">{`  ·  ${m.method}`}</Text>
              </Text>
            </View>
          ))
        )}
        <Text className={`mt-1 text-[11px] ${detailCls}`}>{detail}</Text>
      </View>

      {/* 右侧：状态胶囊 + 箭头 */}
      <View className="w-16 items-end">
        {pill}
        <View className="mt-1.5">
          <Icon name="chevron" size={16} color={color('mutedLight')} />
        </View>
      </View>
    </Pressable>
  );
}

/** 未开始时的计划占位卡，对应 legacy buildPlanPlaceholder()。 */
export function PlanPlaceholder({ doseCount, interval }: { doseCount: number; interval: number }) {
  return (
    <View className="rounded-[18px] border border-line bg-card px-4 pb-2.5 pt-2 dark:border-line-d dark:bg-card-d">
      {Array.from({ length: doseCount }).map((_, i) => (
        <View key={i}>
          <View className="flex-row items-center py-2">
            <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-mint dark:bg-mint-d">
              <Text className="text-[12px] font-medium text-primary dark:text-primary-d">
                {i + 1}
              </Text>
            </View>
            <View className="ml-2.5 flex-1">
              <Medium className="text-[13.5px]">第{i + 1}次</Medium>
              <TextMuted className="mt-0.5 text-[11.5px]">
                {i === 0
                  ? '起床服药后，点上面的按钮记录时间'
                  : `上次实际服药后 ${interval} 小时，自动提醒`}
              </TextMuted>
            </View>
          </View>
          {i < doseCount - 1 && <View className="h-px bg-line dark:bg-line-d" />}
        </View>
      ))}

      <Text className="py-2.5 text-[11.5px] leading-[15px] text-muted-light dark:text-muted-light-d">
        {doseCount <= 1
          ? '每天 1 次，记录第一次后即完成。可在设置里修改次数和间隔。'
          : '每次实际服药后，下一次会从实际时间重新计算。可在设置里修改次数和间隔。'}
      </Text>
    </View>
  );
}

/** 「我的药物」快捷入口，对应 legacy buildMedsShortcut()。 */
export function MedsShortcut({
  total,
  active,
  onPress,
}: {
  total: number;
  active: number;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-[18px] border border-line bg-card px-3.5 py-3 active:opacity-80 dark:border-line-d dark:bg-card-d"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-mint dark:bg-mint-d">
        <Icon name="pill" size={21} color={color('primary')} />
      </View>
      <View className="ml-2.5 flex-1">
        <Medium className="text-[14px]">我的药物</Medium>
        <TextMuted className="mt-0.5 text-[11.5px]">
          {total === 0 ? '还没有添加药物' : `共 ${total} 种 · 已启用 ${active} 种`}
        </TextMuted>
      </View>
      <Text className="px-2 text-[12.5px] font-medium text-primary dark:text-primary-d">
        {total === 0 ? '去添加' : '管理'}
      </Text>
      <Icon name="chevron" size={16} color={color('mutedLight')} />
    </Pressable>
  );
}

/** 最近记录，对应 legacy buildHistory()（最多显示 3 条）。 */
export function HistoryList({ history }: { history: HistoryItem[] }) {
  const items = history.slice(0, 3);

  return (
    <View className="overflow-hidden rounded-[18px] border border-line bg-card dark:border-line-d dark:bg-card-d">
      {items.map((h, i) => {
        const full = h.taken >= h.total;
        const date =
          h.date && h.date.length > 0 ? dateKeyToCn(h.date) : formatMonthDay(h.startAt);
        return (
          <View key={`${h.startAt}-${i}`}>
            <View className="flex-row items-center px-3.5 py-3">
              <View className="flex-1">
                <Medium className="text-[13.5px]">{date}</Medium>
                <TextMuted className="mt-0.5 text-[11.5px]">{h.summary}</TextMuted>
              </View>
              <View
                className={`rounded-xl px-2 py-1 ${
                  full ? 'bg-mint dark:bg-mint-d' : 'bg-amber-bg dark:bg-amber-bg-d'
                }`}
              >
                <Text
                  className={`text-[13px] font-medium ${
                    full ? 'text-primary dark:text-primary-d' : 'text-amber dark:text-amber-d'
                  }`}
                >
                  {h.taken}/{h.total}
                </Text>
              </View>
            </View>
            {i < items.length - 1 && <View className="h-px bg-line dark:bg-line-d" />}
          </View>
        );
      })}
    </View>
  );
}

// 局部引入避免循环依赖
/** 板块标题，对应 legacy sectionHeader()。 */
export function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: string | null;
}) {
  return (
    <View className="flex-row items-center pb-2 pt-0.5">
      <Bold className="flex-1 text-[16.5px]">{title}</Bold>
      {trailing ? (
        <View className="rounded-xl bg-mint px-2 py-1 dark:bg-mint-d">
          <Text className="text-[11.5px] text-muted dark:text-muted-d">{trailing}</Text>
        </View>
      ) : null}
    </View>
  );
}

