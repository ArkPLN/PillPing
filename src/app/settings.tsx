import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { goBack } from '@/lib/nav';

import { ConfirmDialog } from '@/components/forms/Dialogs';
import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Chip } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { Bold, Medium, TextBody, TextMuted } from '@/components/ui/Text';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { scheduleTestIn, syncAll } from '@/lib/notifications/scheduler';
import { presentNow } from '@/lib/notifications/scheduler';
import { formatTime, todayKey } from '@/lib/format';
import * as Perms from '@/lib/perms';
import { usePerms } from '@/lib/usePerms';
import { useTheme, THEME_DARK, THEME_LIGHT, THEME_SYSTEM } from '@/lib/theme';
import { useStore } from '@/store/useStore';
import { useNow } from '@/lib/useNow';
import { isCourseActive } from '@/lib/med';
import { aggregateDay } from '@/lib/timeline';
import { slotDose } from '@/lib/plan';
import { formatDose } from '@/lib/units';

/** 通用设置行（标题 + 副标题 + 右侧动作）。 */
function Row({
  title,
  subtitle,
  action,
  onPress,
  danger = false,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const content = (
    <View className="flex-row items-center rounded-2xl border border-line bg-card px-3.5 py-3 dark:border-line-d dark:bg-card-d">
      <View className="flex-1">
        <Medium className={`text-[13.5px] ${danger ? 'text-danger dark:text-danger-d' : ''}`}>
          {title}
        </Medium>
        {!!subtitle && <TextMuted className="mt-0.5 text-[11.5px] leading-[15px]">{subtitle}</TextMuted>}
      </View>
      {action}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      {content}
    </Pressable>
  );
}

/** 权限行：带状态圆点 + 去开启。 */
function PermRow({
  title,
  ok,
  offHint,
  onFix,
}: {
  title: string;
  ok: boolean;
  offHint: string;
  onFix: () => void;
}) {
  return (
    <View className="flex-row items-center rounded-2xl border border-line bg-card px-3.5 py-3 dark:border-line-d dark:bg-card-d">
      <View
        className={`mr-2.5 h-2 w-2 rounded-full ${
          ok ? 'bg-[#16A34A]' : 'bg-amber dark:bg-amber-d'
        }`}
      />
      <View className="flex-1">
        <Medium className="text-[13.5px]">{title}</Medium>
        <TextMuted
          className={`mt-0.5 text-[11.5px] ${
            ok ? '' : 'text-amber dark:text-amber-d'
          }`}
        >
          {ok ? '已开启' : offHint}
        </TextMuted>
      </View>
      {!ok && (
        <Pressable onPress={onFix} className="px-2 py-1.5 active:opacity-70">
          <Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">去开启</Text>
        </Pressable>
      )}
    </View>
  );
}

function Section({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-5 text-[12.5px] font-medium tracking-wide text-primary dark:text-primary-d">
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
  const { mode, setMode, isDark, color } = useTheme();

  const store = useStore();
  const { meds, records, remindersEnabled, specials } = store;

  const [permKey, setPermKey] = useState(0);
  const perms = usePerms(permKey);

  const [confirmClearToday, setConfirmClearToday] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const bump = useCallback(() => setPermKey((k) => k + 1), []);

  /* ---------------- 提醒总开关 ---------------- */
  const toggleReminders = useCallback(
    async (value: boolean) => {
      store.setRemindersEnabled(value);
      if (value) {
        await syncAll(buildSchedulerInput());
        Alert.alert('已恢复', '已恢复所有提醒');
      } else {
        await syncAll({ ...buildSchedulerInput(), remindersEnabled: false });
        Alert.alert('已暂停', '已暂停所有提醒');
      }
    },
    [store]
  );

  /* ---------------- 测试 ---------------- */
  const sendTest = useCallback(async () => {
    const ok = await Perms.notificationsEnabled();
    if (!ok) {
      await Perms.requestNotifications();
      Alert.alert('提示', '请先允许通知权限');
      return;
    }
    await presentNow({
      title: '测试提醒 · 通知正常',
      body: '真正到点时，会像这样提醒你。',
    });
    Alert.alert('已发送', '请下拉通知栏查看');
  }, []);

  const sendBackgroundTest = useCallback(async () => {
    const ok = await Perms.notificationsEnabled();
    if (!ok) {
      await Perms.requestNotifications();
      Alert.alert('提示', '请先允许通知权限');
      return;
    }
    try {
      await scheduleTestIn(10);
      Alert.alert('已安排', '请按 Home 退出并等待 10 秒');
    } catch {
      Alert.alert('安排失败', '请检查精确提醒权限');
    }
  }, []);

  const sendPreview = useCallback(async () => {
    const agg = aggregateDay(meds, records, todayKey(), Date.now());
    const entry = agg.entries.find((e) => e.status === 'pending' || e.status === 'missed');
    if (!entry) {
      Alert.alert('提示', '今天没有待服用的剂量');
      return;
    }
    const dose = entry.slot
      ? slotDose(entry.med, entry.slot)
      : { qty: entry.med.doseQty, unit: entry.med.doseUnit };
    await presentNow({
      title: '预览 · 该吃药了',
      body: `${entry.med.name} ${formatDose(dose.qty, dose.unit)}（${entry.med.method}）`,
    });
    Alert.alert('已发送预览', '请下拉通知栏查看');
  }, [meds, records]);

  /* ---------------- 数据 ---------------- */
  const doClearToday = useCallback(async () => {
    setConfirmClearToday(false);
    store.clearToday();
    await syncAll(buildSchedulerInput());
    Alert.alert('已完成', '今日记录已清空');
  }, [store]);

  const doClearAll = useCallback(async () => {
    setConfirmClearAll(false);
    store.clearAll();
    await syncAll({ ...buildSchedulerInput(), remindersEnabled: false });
    Alert.alert('已完成', '全部数据已清空');
  }, [store]);

  const version = Constants.expoConfig?.version ?? '2.1.0';
  const activeCount = meds.filter((m) => m.enabled && isCourseActive(m, now)).length;
  const todayAgg = aggregateDay(meds, records, todayKey(), now);
  const pendingCount = Math.max(0, todayAgg.total - todayAgg.taken);


  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title="设置"
          subtitle="提醒开关、节奏、外观与数据"
          action={
            <HeaderIconButton accessibilityLabel="关闭" onPress={() => goBack()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        {/* 提醒总开关 */}
        <Section>提醒总开关</Section>
        <View className="flex-row items-center rounded-2xl border border-line bg-card px-3.5 py-3 dark:border-line-d dark:bg-card-d">
          <View className="flex-1">
            <Medium className="text-[14px]">所有服药提醒</Medium>
            <TextMuted className="mt-0.5 text-[11.5px] leading-[15px]">
              关闭后暂停普通药、特殊药和复诊提醒；记录保留
            </TextMuted>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={toggleReminders}
            trackColor={{ true: color('primary') + '99', false: color('line') }}
            thumbColor={remindersEnabled ? color('primary') : color('mutedLight')}
          />
        </View>

        {/* 外观 */}
        <Section>外观</Section>
        <TextMuted className="mb-2 text-[12.5px]">主题模式</TextMuted>
        <View className="flex-row flex-wrap gap-1.5">
          <Chip label="跟随系统" selected={mode === THEME_SYSTEM} onPress={() => setMode(THEME_SYSTEM)} />
          <Chip label="浅色" selected={mode === THEME_LIGHT} onPress={() => setMode(THEME_LIGHT)} />
          <Chip label="深色" selected={mode === THEME_DARK} onPress={() => setMode(THEME_DARK)} />
        </View>
        <TextMuted className="mt-1 text-[11px]">跟随系统时，应用会随手机的深色/浅色模式自动切换。</TextMuted>

        {/* 开始指南 */}
        <View className="mt-4">
          <Row
            title="开始指南"
            subtitle="检查通知、横幅、精确提醒和后台运行"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">查看</Text>}
            onPress={() => router.push('/guide')}
          />
        </View>

        {/* 状态汇总 */}
        <View
          className={`mt-2.5 rounded-2xl border p-3.5 ${
            !remindersEnabled
              ? 'border-line bg-field dark:border-line-d dark:bg-field-d'
              : 'border-mint-strong bg-mint dark:border-primary-d/40 dark:bg-mint-d'
          }`}
        >
          <Medium className="text-[13px] text-primary dark:text-primary-d">
            {!remindersEnabled ? '提醒状态：已暂停' : '提醒状态：正常'}
          </Medium>
          <TextMuted className="mt-1 text-[11.5px] leading-[15px]">
            {!remindersEnabled
              ? '提醒总开关已关闭，所有服药和复诊提醒暂停。'
              : `已启用 ${activeCount} 种药物 · 今日剩余 ${pendingCount} 次 · 特殊用药 ${specials.length} 种`}
          </TextMuted>
        </View>

        {/* 提醒权限 */}
        <Section>提醒权限</Section>
        <View className="gap-2">
          <PermRow
            title="通知权限"
            ok={perms.notifications}
            offHint="到点弹出提醒、发出声音"
            onFix={async () => {
              await Perms.requestNotifications();
              bump();
            }}
          />
          <PermRow
            title="通知横幅 / 锁屏"
            ok={perms.channelHigh}
            offHint="没弹出横幅或锁屏不显示时，把重要性设为高"
            onFix={async () => {
              await Perms.openChannelSettings();
            }}
          />
          <PermRow
            title="精确提醒"
            ok={perms.exactAlarms !== false}
            offHint="按分钟准时触发，避免系统延迟"
            onFix={async () => {
              await Perms.openExactAlarmSettings();
            }}
          />
          <PermRow
            title="后台运行"
            ok={true}
            offHint="避免系统冻结应用导致漏提醒"
            onFix={async () => {
              await Perms.openBatterySettings();
            }}
          />
        </View>

        <View className="mt-2 gap-2">
          <Row
            title="通知样式"
            subtitle="没弹出横幅或锁屏不显示时，在这里把重要性设为「高」"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">去设置</Text>}
            onPress={() => Perms.openChannelSettings()}
          />
          <Row
            title="勿扰模式"
            subtitle="勿扰开启时通知可能没有声音/振动"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">去设置</Text>}
            onPress={() => Perms.openDndSettings()}
          />
          <Row
            title="电池与后台"
            subtitle="允许后台运行，避免被系统冻结"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">去设置</Text>}
            onPress={() => Perms.openBatterySettings()}
          />
          <Row
            title="打开应用设置"
            subtitle="自启动 / 后台高耗电 / 锁屏显示等厂商设置入口"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">打开</Text>}
            onPress={() => Perms.openAppDetails()}
          />
        </View>

        <TextMuted className="mt-2.5 text-[11.5px] leading-[16px]">
          如果提醒仍不准时：在系统设置 → 应用 → 按时吃药 中，允许「自启动」「后台高耗电」或「不受限制」。
        </TextMuted>

        {/* 测试 */}
        <Section>测试</Section>
        <View className="gap-2">
          <Row
            title="发送测试提醒"
            subtitle="立即发一条通知，检查声音和横幅"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">发送</Text>}
            onPress={sendTest}
          />
          <Row
            title="后台测试提醒"
            subtitle="10 秒后触发；请按 Home 退出，验证后台能否收到"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">测试</Text>}
            onPress={sendBackgroundTest}
          />
          <Row
            title="预览下一次提醒"
            subtitle="按当前药物清单生成一条真实通知（不会改变记录）"
            action={<Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">预览</Text>}
            onPress={sendPreview}
          />
        </View>

        {/* 数据 */}
        <Section>数据</Section>
        <View className="gap-2">
          <Row
            title="清空今日记录"
            subtitle="保留药物清单和历史记录"
            danger
            action={<Icon name="chevron" size={16} color={color('mutedLight')} />}
            onPress={() => setConfirmClearToday(true)}
          />
          <Row
            title="清空全部数据"
            subtitle="删除药物、今日记录和所有历史"
            danger
            action={<Icon name="chevron" size={16} color={color('mutedLight')} />}
            onPress={() => setConfirmClearAll(true)}
          />
        </View>

        {/* 关于 */}
        <View className="mt-6 border-t border-line pt-4 dark:border-line-d">
          <Medium className="text-[12.5px] text-muted dark:text-muted-d">
            按时吃药  v{version}
          </Medium>
          <TextMuted className="mt-1 text-[11.5px]">Demo作者：肚小圆</TextMuted>
          <TextMuted className="mt-1 text-[11.5px]">应用改造与开发：arkpln</TextMuted>
          <TextMuted className="mt-0.5 text-[11px]">Built With React Native</TextMuted>
          <TextMuted className="mt-1.5 text-[11.5px] leading-[16px]">
            本应用仅用于服药时间提醒，不提供任何实际诊断或用药建议。具体药物、剂量和服用方式请遵医嘱。
          </TextMuted>
        </View>

        <Pressable
          onPress={() => goBack()}
          className="mt-5 items-center rounded-2xl bg-primary py-3.5 active:opacity-80 dark:bg-primary-d"
        >
          <Text className="text-[15px] font-bold text-white dark:text-on-bright-d">完成</Text>
        </Pressable>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

      <ConfirmDialog
        visible={confirmClearToday}
        title="清空今日记录"
        message="今天的服药记录和提醒会被清除，药物清单不受影响。"
        positiveLabel="清空"
        onCancel={() => setConfirmClearToday(false)}
        onConfirm={doClearToday}
      />
      <ConfirmDialog
        visible={confirmClearAll}
        title="清空全部数据"
        message="药物清单、今天的记录和历史都会删除，且无法恢复。"
        positiveLabel="全部删除"
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={doClearAll}
      />
    </View>
  );
}
