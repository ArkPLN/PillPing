import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBack } from '@/lib/nav';

import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Icon } from '@/components/ui/Icon';
import { Bold, Medium, TextMuted } from '@/components/ui/Text';
import { scheduleTestIn } from '@/lib/notifications/scheduler';
import * as Perms from '@/lib/perms';
import { usePerms } from '@/lib/usePerms';
import { useTheme } from '@/lib/theme';
import { useStore } from '@/store/useStore';

/**
 * 开始指南。对应 legacy GuideSheet.java。
 *
 * 7 项检查：
 * 1 添加药物
 * 2 通知权限
 * 3 通知横幅 / 锁屏
 * 4 勿扰模式 / 静音
 * 5 精确提醒
 * 6 后台运行
 * 7 自启动 / 后台高耗电（只能跳转）
 *
 * 底部提供 10 秒后台测试。
 */

type Status = 1 | 2 | 3; // 1=ok, 2=manual(灰点), 3=warn(琥珀)

function Sec({
  title,
  status,
  desc,
  actionLabel,
  onAction,
}: {
  title: string;
  status: Status;
  desc: string;
  actionLabel?: string | null;
  onAction?: () => void;
}) {
  const { color } = useTheme();
  const dotColor = status === 1 ? '#16A34A' : status === 2 ? color('mutedLight') : color('amber');
  const descCls =
    status === 3 ? 'text-amber dark:text-amber-d' : 'text-muted dark:text-muted-d';

  return (
    <View className="flex-row items-center rounded-[15px] border border-line bg-card px-3 py-2.5 dark:border-line-d dark:bg-card-d">
      <View
        className="mr-2.5 h-2 w-2 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <View className="flex-1">
        <Medium className="text-[13px]">{title}</Medium>
        <TextMuted className={`mt-0.5 text-[11px] leading-[14px] ${descCls}`}>{desc}</TextMuted>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} className="px-2 py-1.5 active:opacity-70">
          <Text
            className={`text-[12px] font-medium ${
              status === 3
                ? 'text-amber dark:text-amber-d'
                : 'text-primary dark:text-primary-d'
            }`}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : status === 1 ? (
        <Icon name="check" size={16} color="#16A34A" />
      ) : null}
    </View>
  );
}

export default function GuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const [permKey, setPermKey] = useState(0);
  const perms = usePerms(permKey);
  const bump = useCallback(() => setPermKey((k) => k + 1), []);

  const meds = useStore((s) => s.meds);
  const setOnboarded = useStore((s) => s.setOnboarded);

  const hasMeds = meds.length > 0;

  const runBackgroundTest = useCallback(async () => {
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

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title="开始指南"
          subtitle="设置好之后，退出应用也能按时收到提醒。"
          action={
            <HeaderIconButton accessibilityLabel="关闭" onPress={() => goBack()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        <Pressable
          onPress={() => {
            setOnboarded(true);
            bump();
          }}
          className="mt-1 self-end px-2 py-1 active:opacity-70"
        >
          <Text className="text-[12px] font-medium text-primary dark:text-primary-d">
            重新检查状态
          </Text>
        </Pressable>

        <View className="mt-2 gap-1.5">
          <Sec
            title="1  添加药物"
            status={hasMeds ? 1 : 3}
            desc={hasMeds ? `已添加 ${meds.length} 种药物` : '还没有添加药物'}
            actionLabel={hasMeds ? null : '去添加'}
            onAction={hasMeds ? undefined : () => router.replace('/meds')}
          />

          <Sec
            title="2  通知权限"
            status={perms.notifications ? 1 : 3}
            desc={perms.notifications ? '已开启，可以收到通知' : '未开启，到点不会提醒'}
            actionLabel={perms.notifications ? null : '去开启'}
            onAction={
              perms.notifications
                ? undefined
                : async () => {
                    await Perms.requestNotifications();
                    bump();
                  }
            }
          />

          <Sec
            title="3  通知横幅 / 锁屏"
            status={perms.channelHigh ? 1 : 3}
            desc={
              perms.channelHigh ? '渠道重要性为高，横幅与锁屏可显示' : '没有弹出横幅或锁屏不显示时，在这里设置'
            }
            actionLabel={perms.channelHigh ? null : '去设置'}
            onAction={perms.channelHigh ? undefined : () => Perms.openNotificationSettings()}
          />

          <Sec
            title="4  勿扰模式 / 静音"
            status={1}
            desc="勿扰开启时通知可能没有声音或振动"
            actionLabel="去设置"
            onAction={() => Perms.openDndSettings()}
          />

          <Sec
            title="5  精确提醒"
            status={perms.exactAlarms === false ? 3 : 1}
            desc={
              perms.exactAlarms === false
                ? '未开启，提醒可能延迟'
                : '请在系统设置中确认已允许'
            }
            actionLabel={perms.exactAlarms === false ? '去开启' : '去设置'}
            onAction={() => Perms.openExactAlarmSettings()}
          />

          <Sec
            title="6  后台运行"
            status={1}
            desc="请在系统设置中允许后台运行，避免被冻结"
            actionLabel="去设置"
            onAction={() => Perms.openBatterySettings()}
          />

          <Sec
            title="7  自启动 / 后台高耗电"
            status={2}
            desc="vivo / OPPO / 小米等手机需要手动允许"
            actionLabel="打开应用设置"
            onAction={() => Perms.openAppDetails()}
          />
        </View>

        <TextMuted className="mt-3.5 text-[11.5px] leading-[16px]">
          找不到「自启动」时：系统设置 → 应用 → 按时吃药 → 允许自启动、后台高耗电、锁屏显示。
          {'\n'}
          如果按 Home 后测试提醒没到，请先检查第 2–7 项。
        </TextMuted>

        {/* 后台测试 */}
        <View className="mt-4 rounded-2xl border border-amber-line bg-amber-bg p-3.5 dark:border-amber-line-d dark:bg-amber-bg-d">
          <Medium className="text-[13.5px] text-amber dark:text-amber-d">后台测试提醒</Medium>
          <TextMuted className="mt-1 text-[11.5px] leading-[15px] text-amber dark:text-amber-d">
            点下面的按钮，然后按 Home 退出应用，等 10 秒看是否收到通知。
          </TextMuted>
          <Pressable
            onPress={runBackgroundTest}
            className="mt-2.5 items-center rounded-2xl bg-amber py-3 active:opacity-80 dark:bg-amber-d"
          >
            <Text className="text-[14px] font-bold text-white dark:text-on-bright-d">
              10 秒后测试
            </Text>
          </Pressable>
        </View>

        <View className="mt-4 flex-row items-center">
          <Pressable onPress={() => goBack()} className="px-3 py-3 active:opacity-70">
            <TextMuted className="text-[13px]">稍后设置</TextMuted>
          </Pressable>
          <View className="flex-1" />
          <Pressable
            onPress={async () => {
              setOnboarded(true);
              goBack();
              const ok = await Perms.notificationsEnabled();
              if (!ok) await Perms.requestNotifications();
            }}
            className="w-[120px] items-center rounded-2xl bg-primary py-3 active:opacity-80 dark:bg-primary-d"
          >
            <Text className="text-[15px] font-bold text-white dark:text-on-bright-d">完成</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}
