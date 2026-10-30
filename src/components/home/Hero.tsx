import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { HeroButton, HeroOutlineButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Bold, Medium } from '@/components/ui/Text';
import {
  allResolved,
  effectiveTime,
  isStarted,
  nextPending,
  skippedCount,
  takenCount,
} from '@/lib/cycle';
import { formatDuration, formatDurationShort, formatTime, dayLabel } from '@/lib/format';
import { medsForSlot } from '@/lib/med';
import type { Cycle, Med } from '@/lib/types';
import { useTheme } from '@/lib/theme';

/**
 * Hero 卡片三态，对应 legacy buildStartHero / buildActiveHero / buildDoneHero。
 * 背景统一为主色渐变（legacy 用 Ui.gradient(#0F766E → #0D9488)）。
 */

function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-[28px] bg-primary p-[22px] dark:bg-primary-d">
      {/* 装饰圆：legacy addDecor 的两个半透明圆 */}
      <View
        pointerEvents="none"
        className="absolute -right-14 -top-[70px] h-[190px] w-[190px] rounded-full bg-white/10"
      />
      <View
        pointerEvents="none"
        className="absolute -left-12 -bottom-[50px] h-[130px] w-[130px] rounded-full bg-white/5"
      />
      {children}
    </View>
  );
}

/** 顶部小标签（白色半透明）。 */
function HeroLabel({ children }: { children: React.ReactNode }) {
  return <Text className="text-[12px] font-medium tracking-wide text-white/80">{children}</Text>;
}

// ---------------------------------------------------------------- 未开始

export function StartHero({
  interval,
  doseCount,
  firstAt,
  medCount,
  previous,
  onPickTime,
  onStart,
  onGoMeds,
}: {
  interval: number;
  doseCount: number;
  firstAt: number;
  medCount: number;
  previous: Cycle | null;
  onPickTime: () => void;
  onStart: () => void;
  onGoMeds: () => void;
}) {
  let oldText: string | null = null;
  if (previous && isStarted(previous)) {
    if (allResolved(previous)) {
      oldText = `上次已完成 ${takenCount(previous)}/${previous.count}`;
    } else {
      oldText = `上次还有 ${previous.count - takenCount(previous) - skippedCount(previous)} 次未记录`;
    }
  }

  return (
    <HeroShell>
      <HeroLabel>今天 · 第 1 次</HeroLabel>

      <Text className="mt-2 text-[25px] font-bold leading-[28px] text-white">
        起床吃药后，{'\n'}点一下开始计时
      </Text>

      <Text className="mt-2 text-[13px] text-white/85">
        之后每 {interval} 小时提醒一次，共 {doseCount} 次
      </Text>

      {oldText && <Text className="mt-1.5 text-[11.5px] text-white/60">{oldText} · 开始后会归档</Text>}

      <Pressable
        onPress={onPickTime}
        className="mt-4 flex-row items-center rounded-2xl bg-white/12 px-3.5 py-2.5 active:opacity-80"
      >
        <View className="flex-1">
          <Text className="text-[10.5px] text-white/70">第一次服药时间</Text>
          <Text className="mt-0.5 text-[15px] font-bold text-white">
            今天 {formatTime(firstAt)}
          </Text>
        </View>
        <View className="rounded-full bg-white/15 px-3 py-1.5">
          <Text className="text-[12px] font-medium text-white">修改</Text>
        </View>
      </Pressable>

      <HeroButton label="记录第一次服药" className="mt-3.5 h-[54px]" onPress={onStart} />

      {medCount === 0 && (
        <Pressable onPress={onGoMeds} className="mt-3 active:opacity-70">
          <Text className="text-[11.5px] text-white/85">还没有添加药物，提醒里不会显示药品 ›</Text>
        </Pressable>
      )}
    </HeroShell>
  );
}

// ---------------------------------------------------------------- 进行中

export function ActiveHero({
  cycle,
  meds,
  now,
  onTake,
  onSnooze,
  onBackfill,
  onGoMeds,
}: {
  cycle: Cycle;
  meds: Med[];
  now: number;
  onTake: () => void;
  onSnooze: () => void;
  onBackfill: () => void;
  onGoMeds: () => void;
}) {
  const next = nextPending(cycle);
  if (next < 0) return null;

  const due = effectiveTime(cycle, next);
  const overdue = due <= now;
  const remaining = due - now;
  const snoozed = cycle.snoozeUntil[next] > 0;
  const list = medsForSlot(meds, next, now);

  return (
    <HeroShell>
      <View className="flex-row items-center">
        <View className="flex-1">
          <HeroLabel>{overdue ? '该吃药了 · 请尽快服用' : '下一次服药'}</HeroLabel>
        </View>
        <View className="rounded-full bg-white/15 px-2.5 py-1">
          <Text className="text-[11px] font-medium text-white">第{next + 1}次</Text>
        </View>
      </View>

      <View className="mt-0.5 flex-row items-baseline">
        <Text className="text-[44px] font-bold leading-[50px] text-white">{formatTime(due)}</Text>
        {dayLabel(due) !== '今天' && (
          <Text className="ml-2 text-[13px] text-white/80">{dayLabel(due)}</Text>
        )}
        {snoozed && <Text className="ml-2 text-[12px] text-white/80">已推迟</Text>}
      </View>

      <CountdownText remaining={remaining} overdue={overdue} />

      <ProgressRow cycle={cycle} />

      {list.length === 0 ? (
        <Pressable onPress={onGoMeds} className="mt-3 active:opacity-70">
          <Text className="text-[11.5px] text-white/85">本次还没有配置药物，点「药物」页添加</Text>
        </Pressable>
      ) : (
        <Text className="mt-3 text-[12px] text-white/80">
          {list.map((m) => `${m.name} ${m.dose}`).join('  ·  ')}
        </Text>
      )}

      <View className="mt-4 flex-row gap-2.5">
        <HeroButton label="我已服用" className="h-[50px] flex-1" onPress={onTake} />
        <HeroOutlineButton label="推迟 10 分钟" className="h-[50px] flex-1" onPress={onSnooze} />
      </View>

      <Pressable onPress={onBackfill} className="mt-2.5 active:opacity-70">
        <Text className="text-center text-[11.5px] text-white/85">
          忘记登记？补登第{next + 1}次实际时间 ›
        </Text>
      </Pressable>
    </HeroShell>
  );
}

function CountdownText({ remaining, overdue }: { remaining: number; overdue: boolean }) {
  let text: string;
  if (overdue) {
    text =
      remaining > -60_000
        ? '已到服药时间，请尽快服用'
        : `已超时 ${formatDurationShort(-remaining)}，请尽快服用`;
  } else {
    text = `还有 ${formatDuration(remaining)}`;
  }
  return (
    <Text className={`mt-0.5 text-[14px] ${overdue ? 'text-[#FDE68A]' : 'text-white/85'}`}>
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------- 已完成

export function DoneHero({ cycle }: { cycle: Cycle }) {
  const skipped = skippedCount(cycle);
  const sub =
    skipped > 0
      ? `有 ${skipped} 次标记为跳过，其余已记录`
      : `${cycle.count} 次服药都已记录，辛苦啦`;

  return (
    <HeroShell>
      <HeroLabel>今日完成</HeroLabel>
      <Text className="mt-1 text-[42px] font-bold leading-[48px] text-white">
        {takenCount(cycle)} / {cycle.count}
      </Text>
      <Text className="mt-1 text-[13px] text-white/85">{sub}</Text>
      <ProgressRow cycle={cycle} />
      <Text className="mt-4 text-[11.5px] text-white/60">明天起床吃完第一次药后，再来记录。</Text>
    </HeroShell>
  );
}

// ---------------------------------------------------------------- 进度条

/** 分段进度条，对应 legacy progressRow()。 */
export function ProgressRow({ cycle }: { cycle: Cycle }) {
  const next = nextPending(cycle);
  const taken = takenCount(cycle);

  return (
    <View className="mt-4">
      <View className="flex-row">
        {Array.from({ length: cycle.count }).map((_, i) => {
          const status = cycle.status[i];
          let cls = 'bg-white/20';
          if (status === 1) cls = 'bg-white';
          else if (status === 2) cls = 'bg-white/35';
          else if (i === next) cls = 'bg-[#FDE68A]';

          return (
            <View
              key={i}
              className={`h-1.5 flex-1 rounded-[4px] ${cls}`}
              style={{ marginLeft: i > 0 ? 4 : 0 }}
            />
          );
        })}
      </View>

      <View className="mt-1.5 flex-row items-center">
        <Text className="flex-1 text-[10.5px] text-white/80">
          已服 {taken} / {cycle.count} 次
        </Text>
        <Text
          className={`text-[10.5px] font-medium ${
            next < 0 ? 'text-white/80' : 'text-[#FDE68A]'
          }`}
        >
          {next < 0 ? '全部完成' : `第${next + 1}次 · 下次`}
        </Text>
      </View>
    </View>
  );
}
