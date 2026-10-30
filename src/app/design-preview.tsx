import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AmberButton, HeroButton, HeroOutlineButton, OutlineButton, PrimaryButton, VioletButton } from '@/components/ui/Button';
import { Card, Divider } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Chip, Pill, PressableCard, StepButton } from '@/components/ui/Pill';
import { Medium, TextAmber, TextBody, TextMuted, TextMutedLight, TextPrimary, TextViolet } from '@/components/ui/Text';
import { useTheme, THEME_DARK, THEME_LIGHT, THEME_SYSTEM } from '@/lib/theme';

const TOKENS = [
  ['bg', 'bg-bg dark:bg-bg-d'],
  ['card', 'bg-card dark:bg-card-d'],
  ['mint', 'bg-mint dark:bg-mint-d'],
  ['field', 'bg-field dark:bg-field-d'],
  ['line', 'bg-line dark:bg-line-d'],
  ['primary', 'bg-primary dark:bg-primary-d'],
  ['primary-light', 'bg-primary-light dark:bg-primary-light-d'],
  ['amber', 'bg-amber dark:bg-amber-d'],
  ['amber-bg', 'bg-amber-bg dark:bg-amber-bg-d'],
  ['danger', 'bg-danger dark:bg-danger-d'],
  ['danger-bg', 'bg-danger-bg dark:bg-danger-bg-d'],
  ['violet', 'bg-violet dark:bg-violet-d'],
  ['violet-bg', 'bg-violet-bg dark:bg-violet-bg-d'],
  ['next-bg', 'bg-next-bg dark:bg-next-bg-d'],
  ['overdue-bg', 'bg-overdue-bg dark:bg-overdue-bg-d'],
  ['med-0', 'bg-med-0'],
  ['med-1', 'bg-med-1'],
  ['med-2', 'bg-med-2'],
  ['med-3', 'bg-med-3'],
  ['med-4', 'bg-med-4'],
  ['med-5', 'bg-med-5'],
  ['med-6', 'bg-med-6'],
] as const;

export default function DesignPreview() {
  const { mode, isDark, setMode } = useTheme();

  return (
    <ScrollView className="flex-1 bg-bg dark:bg-bg-d" contentContainerClassName="p-5 pb-10">
      <Text className="text-[25px] font-bold text-ink dark:text-ink-d">设计系统预览</Text>
      <Text className="mt-1 text-[12.5px] text-muted dark:text-muted-d">
        当前：{isDark ? '深色' : '浅色'}
      </Text>

      <View className="mt-4 flex-row gap-2">
        <Chip label="跟随系统" selected={mode === THEME_SYSTEM} onPress={() => setMode(THEME_SYSTEM)} />
        <Chip label="浅色" selected={mode === THEME_LIGHT} onPress={() => setMode(THEME_LIGHT)} />
        <Chip label="深色" selected={mode === THEME_DARK} onPress={() => setMode(THEME_DARK)} />
      </View>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">色板</Text>
      <Card className="p-3">
        <View className="flex-row flex-wrap gap-2">
          {TOKENS.map(([name, cls]) => (
            <View key={name} className="items-center">
              <View className={`h-11 w-11 rounded-xl border border-line dark:border-line-d ${cls}`} />
              <Text className="mt-1 text-[9px] text-muted-light dark:text-muted-light-d">{name}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">文本</Text>
      <Card className="gap-1 p-4">
        <TextBody className="text-[14px]">正文 text-ink</TextBody>
        <TextMuted className="text-[13px]">次要 text-muted</TextMuted>
        <TextMutedLight className="text-[12px]">更弱 text-muted-light</TextMutedLight>
        <TextPrimary className="text-[13px]">主色 text-primary</TextPrimary>
        <TextAmber className="text-[13px]">警示 text-amber</TextAmber>
        <TextViolet className="text-[13px]">特殊 text-violet</TextViolet>
        <Medium className="text-[14px]">Medium 中黑</Medium>
      </Card>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">Pill</Text>
      <View className="flex-row flex-wrap gap-2">
        <Pill>已服用</Pill>
        <Pill tone="muted">待服用</Pill>
        <Pill tone="danger">该吃了</Pill>
        <Pill tone="amber">已推迟</Pill>
        <Pill tone="violet">每 8 小时</Pill>
      </View>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">Chip / Step</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip label="每次" selected />
        <Chip label="第1次" />
        <Chip label="第2次" />
        <StepButton>
          <Icon name="minus" size={18} color="#0F766E" />
        </StepButton>
        <StepButton>
          <Icon name="add" size={18} color="#0F766E" />
        </StepButton>
      </View>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">按钮</Text>
      <View className="gap-2.5">
        <PrimaryButton label="我已服用" />
        <VioletButton label="已服用（特殊）" />
        <AmberButton label="10 秒后测试" />
        <OutlineButton label="10 分钟后再提醒" />
      </View>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">
        Hero 按钮
      </Text>
      <View className="gap-2.5 rounded-[28px] bg-primary p-4 dark:bg-primary-d">
        <HeroButton label="记录第一次服药" />
        <HeroOutlineButton label="推迟 10 分钟" />
      </View>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">图标</Text>
      <Card className="p-4">
        <View className="flex-row flex-wrap gap-4">
          {(
            [
              'today',
              'pill',
              'clock',
              'bell',
              'settings',
              'trash',
              'check',
              'close',
              'chevron',
              'calendar',
              'heart',
              'wave',
              'formTablet',
              'formCapsule',
              'formLiquid',
              'formInjection',
              'formTopical',
              'formOther',
            ] as const
          ).map((n) => (
            <View key={n} className="items-center" style={{ width: 56 }}>
              <Icon name={n} size={24} color="#0F766E" />
              <Text className="mt-1 text-[8px] text-muted-light dark:text-muted-light-d">{n}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">输入框</Text>
      <Field placeholder="例如：维生素D" />
      <View className="h-2" />
      <Field placeholder="例如：饭后服用 / 不要和牛奶同服" multiline />

      <Text className="mb-2 mt-6 text-[12.5px] font-medium text-primary dark:text-primary-d">
        可点击卡片
      </Text>
      <PressableCard className="p-4" onPress={() => {}}>
        <Medium className="text-[14px]">我的药物</Medium>
        <TextMuted className="mt-1 text-[11.5px]">共 3 种 · 已启用 3 种</TextMuted>
      </PressableCard>

      <View className="my-4">
        <Divider />
      </View>
    </ScrollView>
  );
}
