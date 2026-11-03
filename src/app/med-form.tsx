import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { ConfirmDialog } from '@/components/forms/Dialogs';
import { NumericInput } from '@/components/forms/NumericInput';
import { SelectField } from '@/components/forms/SelectField';
import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { PlanEditor } from '@/components/plan/PlanEditor';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { TextMuted } from '@/components/ui/Text';
import { inferForm, FORM_NAMES } from '@/lib/forms';
import type { FormKey } from '@/lib/icons';
import { FORM_LABELS, FORMS_ORDER } from '@/lib/icons';
import { computeFollowupAt } from '@/lib/med';
import { createTemplatePlan, clonePlanWithNewIds } from '@/lib/plan-template';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import type { Med, SchedulePlan } from '@/lib/types';
import { METHODS } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';
import { goBack } from '@/lib/nav';
import { startOfToday } from '@/utils/datetime';
import { genId } from '@/utils/id';
import { DEFAULT_UNIT, UNITS } from '@/lib/units';
import { DAY_MS } from '@/constants/time';

type Draft = {
  name: string;
  doseQty: string;
  doseUnit: string;
  form: FormKey;
  method: string;
  note: string;
  plan: SchedulePlan;
  courseDays: string;
  followupDays: string;
};

function formKeyOf(form: string): FormKey {
  const entry = (Object.keys(FORM_LABELS) as FormKey[]).find((k) => FORM_LABELS[k] === form);
  return entry ?? 'tablet';
}

function defaultPlan(): SchedulePlan {
  return createTemplatePlan(3, 'after', genId);
}

const FOLLOWUP_OPTIONS = [
  { value: '0', label: '不提醒' },
  { value: '1', label: '第1天' },
  { value: '3', label: '第3天' },
  { value: '5', label: '第5天' },
  { value: '7', label: '1周' },
  { value: '14', label: '2周' },
  { value: '21', label: '3周' },
  { value: '28', label: '4周' },
];

export default function MedFormScreen() {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const meds = useStore((s) => s.meds);
  const templates = useStore((s) => s.templates);
  const addMed = useStore((s) => s.addMed);
  const updateMed = useStore((s) => s.updateMed);
  const removeMed = useStore((s) => s.removeMed);
  const saveTemplate = useStore((s) => s.saveTemplate);

  const editing = useMemo(() => meds.find((m) => m.id === id), [meds, id]);
  const isNew = !editing;

  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) {
      return {
        name: editing.name,
        doseQty: editing.doseQty,
        doseUnit: editing.doseUnit,
        form: formKeyOf(editing.form),
        method: editing.method,
        note: editing.note,
        plan: editing.plan,
        courseDays: String(editing.courseDays),
        followupDays: String(editing.followupDays),
      };
    }
    return {
      name: '',
      doseQty: '1',
      doseUnit: DEFAULT_UNIT,
      form: 'tablet',
      method: '口服',
      note: '',
      plan: defaultPlan(),
      courseDays: '5',
      followupDays: '1',
    };
  });

  const [formTouched, setFormTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);

  // 药名/用量变化时自动推断剂型（用户未手动改过）
  React.useEffect(() => {
    if (formTouched) return;
    const inferred = inferForm(draft.name, `${draft.doseQty}${draft.doseUnit}`, draft.method);
    const key = formKeyOf(inferred);
    if (key !== draft.form) patch({ form: key });
  }, [draft.name, draft.doseQty, draft.doseUnit, draft.method, draft.form, formTouched, patch]);

  const save = useCallback(() => {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('提示', '请填写药名');
      return;
    }
    if (!draft.doseQty.trim()) {
      Alert.alert('提示', '请填写每次用量');
      return;
    }
    if (draft.plan.type !== 'interval' && draft.plan.slots.length === 0) {
      Alert.alert('提示', '请至少设置一个时刻');
      return;
    }

    const courseDays = Math.max(0, Math.min(365, Number(draft.courseDays) || 0));
    const followupDays = Math.max(0, Math.min(365, Number(draft.followupDays) || 0));

    let courseStart = 0;
    if (courseDays > 0) {
      courseStart =
        editing && editing.courseDays > 0 && editing.courseStart > 0
          ? editing.courseStart
          : startOfToday();
    }

    const base: Med = {
      id: editing?.id ?? genId(),
      name,
      doseQty: draft.doseQty.trim(),
      doseUnit: draft.doseUnit,
      method: draft.method,
      form: FORM_LABELS[draft.form],
      note: draft.note.trim(),
      enabled: editing?.enabled ?? true,
      plan: draft.plan,
      color: editing?.color ?? meds.length % 7,
      courseDays,
      courseStart,
      followupDays,
      nextFollowupAt: 0,
    };
    base.nextFollowupAt = computeFollowupAt(base);

    if (isNew) addMed(base);
    else updateMed(base);

    (async () => {
      await syncAll(buildSchedulerInput());
      goBack();
    })();
  }, [draft, editing, isNew, meds.length, addMed, updateMed]);

  const doDelete = useCallback(async () => {
    if (!editing) return;
    removeMed(editing.id);
    setConfirmDelete(false);
    await syncAll(buildSchedulerInput());
    goBack();
  }, [editing, removeMed]);

  const formOptions = FORMS_ORDER.map((k) => ({ value: k, label: FORM_LABELS[k] }));

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={isNew ? '添加药物' : '编辑药物'}
          action={
            <HeaderIconButton accessibilityLabel="返回" onPress={() => goBack()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">药名</TextMuted>
        <Field
          testID="med-name"
          value={draft.name}
          onChangeText={(v) => patch({ name: v })}
          placeholder="药名"
        />

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">每次用量</TextMuted>
        <View className="flex-row items-center gap-2">
          <NumericInput
            testID="med-qty"
            maxFontSizeMultiplier={1.3}
            value={draft.doseQty}
            onChangeText={(v) => patch({ doseQty: v })}
            placeholder="数量"
            accessibilityLabel="数量"
            className="w-[76px] rounded-[14px] border border-line bg-field px-3 py-3 text-center text-[15px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d"
          />
          <View className="w-[120px]">
            <SelectField
              title="单位"
              testID="med-unit"
              columns={4}
              value={draft.doseUnit}
              options={UNITS.map((u) => ({ value: u, label: u }))}
              onChange={(unit) => patch({ doseUnit: unit })}
            />
          </View>
        </View>

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">剂型</TextMuted>
        <SelectField
          title="剂型"
          testID="med-form"
          value={draft.form}
          options={formOptions}
          onChange={(f) => {
            setFormTouched(true);
            patch({ form: f as FormKey });
          }}
        />

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">服用方式</TextMuted>
        <SelectField
          title="服用方式"
          testID="med-method"
          value={draft.method}
          options={METHODS.map((m) => ({ value: m, label: m }))}
          onChange={(method) => patch({ method })}
        />

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">服药时间计划</TextMuted>
        <View className="rounded-2xl border border-line bg-field p-3.5 dark:border-line-d dark:bg-field-d">
          <PlanEditor
            value={draft.plan}
            medQty={draft.doseQty}
            medUnit={draft.doseUnit}
            onChange={(plan) => patch({ plan })}
            onSaveTemplate={(name, plan) => saveTemplate(name, plan)}
          />
          {templates.length > 0 ? (
            <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
              <Text className="text-[11.5px] text-muted dark:text-muted-d">模板</Text>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => patch({ plan: clonePlanWithNewIds(t.plan, genId) })}
                  className="rounded-full bg-card px-2.5 py-1 active:opacity-70 dark:bg-card-d"
                >
                  <Text className="text-[11.5px] text-muted dark:text-muted-d">{t.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">疗程与复诊</TextMuted>
        <View className="rounded-2xl border border-line bg-field p-3.5 dark:border-line-d dark:bg-field-d">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] text-ink dark:text-ink-d">连续服用天数</Text>
            <View className="flex-row items-center gap-1.5">
              <NumericInput
                testID="med-course-days"
                value={draft.courseDays}
                onChangeText={(v) => patch({ courseDays: v })}
                accessibilityLabel="连续服用天数"
                className="w-[64px] rounded-[10px] border border-line bg-card px-2 py-2 text-center text-[13px] text-ink dark:border-line-d dark:bg-card-d dark:text-ink-d"
              />
              <Text className="text-[12px] text-muted dark:text-muted-d">天</Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[13px] text-ink dark:text-ink-d">复诊提醒</Text>
            <View className="w-[120px]">
              <SelectField
                title="复诊提醒"
                testID="med-followup"
                value={draft.followupDays}
                options={FOLLOWUP_OPTIONS}
                onChange={(v) => patch({ followupDays: v })}
              />
            </View>
          </View>
        </View>

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">备注</TextMuted>
        <Field
          testID="med-note"
          value={draft.note}
          onChangeText={(v) => patch({ note: v })}
          placeholder="备注"
          multiline
        />

        <View className="mt-6 flex-row items-center gap-2">
          {!isNew && (
            <Pressable
              testID="med-delete"
              onPress={() => setConfirmDelete(true)}
              className="px-2 py-3 active:opacity-70"
            >
              <Text className="text-[14px] font-medium text-danger dark:text-danger-d">删除</Text>
            </Pressable>
          )}
          <View className="flex-1" />
          <Pressable
            testID="med-cancel"
            onPress={() => goBack()}
            className="px-3 py-3 active:opacity-70"
          >
            <TextMuted className="text-[14px]">取消</TextMuted>
          </Pressable>
          <Pressable
            testID="med-save"
            onPress={save}
            className="w-[112px] items-center rounded-2xl bg-primary py-3 active:opacity-80 dark:bg-primary-d"
          >
            <Text className="text-[15px] font-bold text-white dark:text-on-bright-d">保存</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

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
