import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormPicker } from '@/components/forms/FormPicker';
import { ConfirmDialog, NumberDialog } from '@/components/forms/Dialogs';
import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Chip } from '@/components/ui/Pill';
import { Field } from '@/components/ui/Field';
import { Medium, TextBody, TextMuted } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { inferForm, FORM_NAMES } from '@/lib/forms';
import type { FormKey } from '@/lib/icons';
import { FORM_LABELS, FORMS_ORDER } from '@/lib/icons';
import { isSlot, setSlot as setSlotBit } from '@/lib/med';
import { formatMonthDay } from '@/lib/format';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import type { Med } from '@/lib/types';
import { METHODS } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';

/** 表单内部状态（从 Med 映射而来）。 */
type Draft = {
  name: string;
  dose: string;
  form: FormKey;
  method: string;
  note: string;
  allDoses: boolean;
  slotMask: number;
  courseDays: number;
  courseStart: number;
  followupDays: number;
  nextFollowupAt: number;
};

function formKeyOf(form: string): FormKey {
  const entry = (Object.keys(FORM_LABELS) as FormKey[]).find((k) => FORM_LABELS[k] === form);
  return entry ?? 'tablet';
}

const DOSE_QUICK = ['半片', '1片', '2片', '1粒', '2粒', '5ml', '10ml'];
const COURSE_PRESETS: { label: string; days: number }[] = [
  { label: '长期', days: 0 },
  { label: '7 天', days: 7 },
  { label: '14 天', days: 14 },
  { label: '30 天', days: 30 },
  { label: '90 天', days: 90 },
];
const FOLLOWUP_PRESETS = [
  { label: '14 天', days: 14 },
  { label: '30 天', days: 30 },
  { label: '90 天', days: 90 },
];

function startOfToday(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export default function MedFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const meds = useStore((s) => s.meds);
  const doseCount = useStore((s) => s.doseCount);
  const addMed = useStore((s) => s.addMed);
  const updateMed = useStore((s) => s.updateMed);
  const removeMed = useStore((s) => s.removeMed);

  const editing = useMemo(() => meds.find((m) => m.id === id), [meds, id]);
  const isNew = !editing;

  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) {
      return {
        name: editing.name,
        dose: editing.dose,
        form: formKeyOf(editing.form),
        method: editing.method,
        note: editing.note,
        allDoses: editing.allDoses,
        slotMask: editing.slotMask,
        courseDays: editing.courseDays,
        courseStart: editing.courseStart,
        followupDays: editing.followupDays,
        nextFollowupAt: editing.nextFollowupAt,
      };
    }
    return {
      name: '',
      dose: '',
      form: 'tablet',
      method: '口服',
      note: '',
      allDoses: true,
      slotMask: 0,
      courseDays: 0,
      courseStart: 0,
      followupDays: 0,
      nextFollowupAt: 0,
    };
  });

  const [numDialog, setNumDialog] = useState<null | 'course' | 'followup'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);

  // 药名/用量变化时自动推断剂型（仅新建且用户未手动改过）
  const [formTouched, setFormTouched] = useState(false);
  const autoForm = useCallback(() => {
    if (formTouched) return;
    const inferred = inferForm(draft.name, draft.dose, draft.method);
    const key = formKeyOf(inferred);
    if (key !== draft.form) patch({ form: key });
  }, [draft.name, draft.dose, draft.method, draft.form, formTouched, patch]);

  React.useEffect(() => {
    autoForm();
  }, [autoForm]);

  const toggleSlot = (i: number) => {
    if (draft.allDoses) {
      // 从「每次」切到「指定」，只选中当前点击的这一项
      patch({ allDoses: false, slotMask: 1 << i });
      return;
    }
    const med = { slotMask: draft.slotMask } as Med;
    const next = setSlotBit(med, i, !isSlot(med, i));
    patch({ slotMask: next.slotMask });
  };

  const save = useCallback(() => {
    const name = draft.name.trim();
    const dose = draft.dose.trim();
    if (!name) {
      Alert.alert('提示', '请填写药名');
      return;
    }
    if (!dose) {
      Alert.alert('提示', '请填写每次用量');
      return;
    }
    if (!draft.allDoses && draft.slotMask === 0) {
      Alert.alert('提示', '请至少选择一次服药');
      return;
    }

    const now = Date.now();
    const courseStart =
      draft.courseDays <= 0
        ? 0
        : draft.courseStart > 0 && !(editing && editing.courseDays <= 0)
          ? draft.courseStart
          : startOfToday();

    let nextFollowupAt = 0;
    if (draft.followupDays > 0) {
      if (draft.nextFollowupAt > 0 && !(editing && editing.followupDays !== draft.followupDays)) {
        nextFollowupAt = draft.nextFollowupAt;
      } else {
        nextFollowupAt = now + draft.followupDays * 86_400_000;
      }
    }

    const base: Med = {
      id: editing?.id ?? '',
      name,
      dose,
      method: draft.method,
      form: FORM_LABELS[draft.form],
      note: draft.note.trim(),
      enabled: editing?.enabled ?? true,
      allDoses: draft.allDoses,
      slotMask: draft.slotMask,
      color: editing?.color ?? meds.length % 7,
      courseDays: draft.courseDays,
      courseStart,
      followupDays: draft.followupDays,
      nextFollowupAt,
    };

    if (isNew) {
      addMed({ ...base, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    } else {
      updateMed(base);
    }

    (async () => {
      await syncAll(buildSchedulerInput());
      router.back();
    })();
  }, [draft, editing, isNew, meds.length, addMed, updateMed, router]);

  const doDelete = useCallback(async () => {
    if (!editing) return;
    removeMed(editing.id);
    setConfirmDelete(false);
    await syncAll(buildSchedulerInput());
    router.back();
  }, [editing, removeMed, router]);

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={isNew ? '添加药物' : '编辑药物'}
          subtitle={isNew ? '添加你每天要吃的药，提醒时会自动带上这些信息。' : '修改后，之后的提醒内容会同步更新。'}
          action={
            <HeaderIconButton accessibilityLabel="返回" onPress={() => router.back()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        {/* 药名 */}
        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">药名</TextMuted>
        <Field
          value={draft.name}
          onChangeText={(v) => patch({ name: v })}
          placeholder="例如：维生素D"
        />

        {/* 用量 */}
        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">每次用量</TextMuted>
        <Field
          value={draft.dose}
          onChangeText={(v) => patch({ dose: v })}
          placeholder="例如：1片 / 半粒 / 5ml"
        />
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {DOSE_QUICK.map((q) => (
            <Chip key={q} label={q} onPress={() => patch({ dose: q })} />
          ))}
        </View>

        {/* 剂型 */}
        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">剂型</TextMuted>
        <FormPicker
          value={draft.form}
          onChange={(f) => {
            setFormTouched(true);
            patch({ form: f });
          }}
        />

        {/* 服用方式 */}
        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">服用方式</TextMuted>
        <View className="flex-row flex-wrap gap-1.5">
          {METHODS.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={draft.method === m}
              onPress={() => patch({ method: m })}
            />
          ))}
        </View>

        {/* 服用时机 */}
        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">服用时机</TextMuted>
        <View className="flex-row flex-wrap gap-1.5">
          <Chip
            label="每次"
            selected={draft.allDoses}
            onPress={() => patch({ allDoses: true })}
          />
          {Array.from({ length: doseCount }).map((_, i) => (
            <Chip
              key={i}
              label={`第${i + 1}次`}
              selected={!draft.allDoses && isSlot({ slotMask: draft.slotMask } as Med, i)}
              onPress={() => toggleSlot(i)}
            />
          ))}
        </View>
        <TextMuted className="mt-1.5 text-[11px] leading-[15px]">
          选「每次」会自动包含以后新增的次数；也可以只选某几次。至少选择一次。
        </TextMuted>

        {/* 疗程 */}
        <View className="mt-3.5 flex-row items-center gap-1.5">
          <Icon name="calendar" size={17} color={color('muted')} />
          <TextMuted className="text-[12.5px] font-medium">服药周期</TextMuted>
        </View>
        <View className="mt-1.5 rounded-2xl border border-line bg-field p-3.5 dark:border-line-d dark:bg-field-d">
          <View className="flex-row flex-wrap items-center">
            <View className="flex-1 pr-2">
              <Medium className="text-[13.5px]">连续服用天数</Medium>
              <TextMuted className="mt-0.5 text-[11px]">0 = 不限制；到期后自动停止该药提醒</TextMuted>
            </View>
            <View className="flex-row items-center">
              <Pressable
                onPress={() => {
                  const v = Math.max(0, draft.courseDays - 1);
                  patch({
                    courseDays: v,
                    courseStart: v > 0 && draft.courseStart <= 0 ? startOfToday() : draft.courseStart,
                  });
                }}
                className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70 dark:bg-card-d"
              >
                <Text className="text-[18px] text-primary dark:text-primary-d">−</Text>
              </Pressable>
              <View className="min-w-[70px] items-center">
                <Text className="text-[14px] font-bold text-primary dark:text-primary-d">
                  {draft.courseDays <= 0 ? '不限制' : `${draft.courseDays} 天`}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const v = Math.min(365, draft.courseDays + 1);
                  patch({ courseDays: v, courseStart: draft.courseStart <= 0 ? startOfToday() : draft.courseStart });
                }}
                className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70 dark:bg-card-d"
              >
                <Text className="text-[18px] text-primary dark:text-primary-d">+</Text>
              </Pressable>
              <Pressable onPress={() => setNumDialog('course')} className="ml-1 px-1.5 py-2">
                <Text className="text-[12px] font-medium text-primary dark:text-primary-d">输入</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {COURSE_PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                selected={draft.courseDays === p.days}
                onPress={() =>
                  patch({
                    courseDays: p.days,
                    courseStart: p.days > 0 ? startOfToday() : 0,
                  })
                }
              />
            ))}
          </View>

          <TextMuted className="mt-2 text-[11px]">
            {draft.courseDays <= 0
              ? '长期服用'
              : `疗程至 ${formatMonthDay(startOfToday() + draft.courseDays * 86_400_000 - 1)}`}
          </TextMuted>
          <TextMuted className="mt-0.5 text-[10.5px]">也可直接点上方「输入」填写天数。</TextMuted>
        </View>

        {/* 复诊 */}
        <View className="mt-3.5 flex-row items-center gap-1.5">
          <Icon name="heart" size={17} color={color('muted')} />
          <TextMuted className="text-[12.5px] font-medium">复诊提醒</TextMuted>
        </View>
        <View className="mt-1.5 rounded-2xl border border-line bg-field p-3.5 dark:border-line-d dark:bg-field-d">
          <View className="flex-row flex-wrap items-center">
            <View className="flex-1 pr-2">
              <Medium className="text-[13.5px]">复诊间隔</Medium>
              <TextMuted className="mt-0.5 text-[11px]">0 = 不提醒；服药期间定期复诊</TextMuted>
            </View>
            <View className="flex-row items-center">
              <Pressable
                onPress={() => patch({ followupDays: Math.max(0, draft.followupDays - 1), nextFollowupAt: 0 })}
                className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70 dark:bg-card-d"
              >
                <Text className="text-[18px] text-violet-text dark:text-violet-text-d">−</Text>
              </Pressable>
              <View className="min-w-[70px] items-center">
                <Text className="text-[14px] font-bold text-violet-text dark:text-violet-text-d">
                  {draft.followupDays <= 0 ? '不提醒' : `${draft.followupDays} 天`}
                </Text>
              </View>
              <Pressable
                onPress={() => patch({ followupDays: Math.min(365, draft.followupDays + 1), nextFollowupAt: 0 })}
                className="h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-70 dark:bg-card-d"
              >
                <Text className="text-[18px] text-violet-text dark:text-violet-text-d">+</Text>
              </Pressable>
              <Pressable onPress={() => setNumDialog('followup')} className="ml-1 px-1.5 py-2">
                <Text className="text-[12px] font-medium text-primary dark:text-primary-d">输入</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {FOLLOWUP_PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                selected={draft.followupDays === p.days}
                onPress={() => patch({ followupDays: p.days, nextFollowupAt: 0 })}
              />
            ))}
          </View>

          <TextMuted className="mt-2 text-[11px]">
            {draft.followupDays <= 0
              ? '不提醒复诊'
              : draft.nextFollowupAt > 0
                ? `复诊 ${formatMonthDay(draft.nextFollowupAt)}`
                : `每 ${draft.followupDays} 天复诊`}
          </TextMuted>
          <TextMuted className="mt-0.5 text-[10.5px]">也可直接点上方「输入」填写间隔天数。</TextMuted>
        </View>

        <TextMuted className="mt-1.5 text-[11px] leading-[15px]">
          疗程结束后该药不再出现在提醒里；复诊提醒只在该药疗程内生效，可单独关闭。
        </TextMuted>

        {/* 备注 */}
        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">备注（可选）</TextMuted>
        <Field
          value={draft.note}
          onChangeText={(v) => patch({ note: v })}
          placeholder="例如：饭后服用 / 不要和牛奶同服"
          multiline
        />

        <TextMuted className="mt-3.5 text-[11.5px]">
          提醒通知会显示：药名、用量、剂型和服用方式。
        </TextMuted>

        {/* 操作 */}
        <View className="mt-5 flex-row items-center gap-2">
          {!isNew && (
            <Pressable
              onPress={() => setConfirmDelete(true)}
              className="px-2 py-3 active:opacity-70"
            >
              <Text className="text-[14px] font-medium text-danger dark:text-danger-d">删除</Text>
            </Pressable>
          )}
          <View className="flex-1" />
          <Pressable onPress={() => router.back()} className="px-3 py-3 active:opacity-70">
            <TextMuted className="text-[14px]">取消</TextMuted>
          </Pressable>
          <Pressable
            onPress={save}
            className="w-[112px] items-center rounded-2xl bg-primary py-3 active:opacity-80 dark:bg-primary-d"
          >
            <Text className="text-[15px] font-bold text-white dark:text-on-bright-d">保存</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

      <NumberDialog
        visible={numDialog === 'course'}
        title="设置服药天数"
        hint="0 = 长期服用；也可以直接输入 1–365 天。"
        initial={draft.courseDays}
        min={0}
        max={365}
        onCancel={() => setNumDialog(null)}
        onConfirm={(v) => {
          setNumDialog(null);
          patch({ courseDays: v, courseStart: v > 0 ? startOfToday() : 0 });
        }}
      />

      <NumberDialog
        visible={numDialog === 'followup'}
        title="设置复诊间隔"
        hint="0 = 不提醒；可以直接输入 1–365 天。"
        initial={draft.followupDays}
        min={0}
        max={365}
        onCancel={() => setNumDialog(null)}
        onConfirm={(v) => {
          setNumDialog(null);
          patch({ followupDays: v, nextFollowupAt: 0 });
        }}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="删除药物"
        message={`确定删除「${editing?.name ?? ''}」吗？之后不会再出现在提醒里。`}
        positiveLabel="删除"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </View>
  );
}
