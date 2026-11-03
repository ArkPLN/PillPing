import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { ConfirmDialog } from '@/components/forms/Dialogs';
import { DateField } from '@/components/forms/DateField';
import { NumericInput } from '@/components/forms/NumericInput';
import { SelectField } from '@/components/forms/SelectField';
import { TimeField } from '@/components/forms/TimeField';
import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Pill';
import { TextMuted } from '@/components/ui/Text';
import { inferForm } from '@/lib/forms';
import { FORM_LABELS, FORMS_ORDER, type FormKey } from '@/lib/icons';
import { computeNext } from '@/lib/specialmed';
import { dateKey, dateKeyToCn, formatMonthDay, formatTime, todayKey } from '@/lib/format';
import { parseTimeText } from '@/lib/plan';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';
import { goBack } from '@/lib/nav';
import { pad2 } from '@/utils/number';
import { genId } from '@/utils/id';
import { DEFAULT_UNIT, UNITS } from '@/lib/units';
import {
  DOSE_SKIPPED,
  DOSE_TAKEN,
  METHODS,
  SPECIAL_MODE_DATES,
  SPECIAL_MODE_ONCE,
  SPECIAL_MODE_WEEKLY,
  type SpecialMed,
  type SpecialMode,
} from '@/lib/types';

type Draft = {
  name: string;
  doseQty: string;
  doseUnit: string;
  form: FormKey;
  method: string;
  note: string;
  mode: SpecialMode;
  onceDate: string;
  times: string[];
  dates: string[];
  weeklyTarget: string;
  weeklyStepDays: string;
};

function formKeyOf(form: string): FormKey {
  const entry = (Object.keys(FORM_LABELS) as FormKey[]).find((k) => FORM_LABELS[k] === form);
  return entry ?? 'tablet';
}

function addHours(time: string, hours: number): string {
  const parsed = parseTimeText(time) ?? { hour: 8, minute: 0 };
  return `${pad2((parsed.hour + hours) % 24)}:${pad2(parsed.minute)}`;
}

export default function SpecialFormScreen() {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const specials = useStore((s) => s.specials);
  const addSpecial = useStore((s) => s.addSpecial);
  const updateSpecial = useStore((s) => s.updateSpecial);
  const removeSpecial = useStore((s) => s.removeSpecial);

  const editing = useMemo(() => specials.find((m) => m.id === id), [specials, id]);
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
        mode: editing.mode,
        onceDate: editing.onceDate || todayKey(),
        times: editing.times.length > 0 ? editing.times : ['10:00'],
        dates: editing.dates,
        weeklyTarget: String(editing.weeklyTarget),
        weeklyStepDays: String(editing.weeklyStepDays),
      };
    }
    return {
      name: '',
      doseQty: '1',
      doseUnit: DEFAULT_UNIT,
      form: 'tablet',
      method: '口服',
      note: '',
      mode: SPECIAL_MODE_ONCE,
      onceDate: todayKey(),
      times: ['10:00'],
      dates: [],
      weeklyTarget: '3',
      weeklyStepDays: '2',
    };
  });

  const [formTouched, setFormTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);

  React.useEffect(() => {
    if (formTouched) return;
    const inferred = inferForm(draft.name, `${draft.doseQty}${draft.doseUnit}`, draft.method);
    const key = formKeyOf(inferred);
    if (key !== draft.form) patch({ form: key });
  }, [draft.name, draft.doseQty, draft.doseUnit, draft.method, draft.form, formTouched, patch]);

  const setTimeAt = (index: number, hour: number, minute: number) => {
    const next = draft.times.slice();
    next[index] = `${pad2(hour)}:${pad2(minute)}`;
    patch({ times: next });
  };

  const removeTimeAt = (index: number) => {
    if (draft.times.length <= 1) return;
    const next = draft.times.slice();
    next.splice(index, 1);
    patch({ times: next });
  };

  const save = useCallback(() => {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('提示', '请填写名称');
      return;
    }
    if (!draft.doseQty.trim()) {
      Alert.alert('提示', '请填写每次用量');
      return;
    }
    if (draft.mode === SPECIAL_MODE_DATES && draft.dates.length === 0) {
      Alert.alert('提示', '请选择日期');
      return;
    }

    const weeklyTarget = Math.max(1, Math.min(14, Number(draft.weeklyTarget) || 3));
    const weeklyStepDays = Math.max(1, Math.min(14, Number(draft.weeklyStepDays) || 2));

    const base: SpecialMed = {
      id: editing?.id ?? genId(),
      code: editing?.code ?? 0,
      name,
      doseQty: draft.doseQty.trim(),
      doseUnit: draft.doseUnit,
      method: draft.method,
      form: FORM_LABELS[draft.form],
      note: draft.note.trim(),
      enabled: editing?.enabled ?? true,
      mode: draft.mode,
      onceDate: draft.mode === SPECIAL_MODE_ONCE ? draft.onceDate : '',
      times:
        draft.mode === SPECIAL_MODE_WEEKLY
          ? editing && editing.times.length > 0
            ? editing.times
            : ['09:00']
          : draft.times,
      dates: draft.mode === SPECIAL_MODE_DATES ? draft.dates : [],
      weeklyTarget,
      weeklyStepDays,
      records: editing?.records ?? [],
      nextAt: 0,
      lastAt: editing?.lastAt ?? 0,
      snoozeUntil: 0,
    };
    base.nextAt = computeNext(base, Date.now());

    if (isNew) addSpecial(base);
    else updateSpecial(base);

    (async () => {
      await syncAll(buildSchedulerInput());
      goBack();
    })();
  }, [draft, editing, isNew, addSpecial, updateSpecial]);

  const doDelete = useCallback(async () => {
    if (!editing) return;
    removeSpecial(editing.id);
    setConfirmDelete(false);
    await syncAll(buildSchedulerInput());
    goBack();
  }, [editing, removeSpecial]);

  const formOptions = FORMS_ORDER.map((k) => ({ value: k, label: FORM_LABELS[k] }));
  const nextPreview = useMemo(() => {
    if (!editing) return '';
    return editing.nextAt > 0 ? `下次 ${formatMonthDay(editing.nextAt)} ${formatTime(editing.nextAt)}` : '';
  }, [editing]);

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={isNew ? '添加特殊用药' : '编辑特殊用药'}
          action={
            <HeaderIconButton accessibilityLabel="返回" onPress={() => goBack()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">名称</TextMuted>
        <Field value={draft.name} onChangeText={(v) => patch({ name: v })} placeholder="名称" />

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">每次用量</TextMuted>
        <View className="flex-row items-center gap-2">
          <NumericInput
            value={draft.doseQty}
            onChangeText={(v) => patch({ doseQty: v })}
            placeholder="数量"
            accessibilityLabel="数量"
            className="w-[76px] rounded-[14px] border border-line bg-field px-3 py-3 text-center text-[15px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d"
          />
          <View className="w-[92px]">
            <SelectField
              value={draft.doseUnit}
              options={UNITS.map((u) => ({ value: u, label: u }))}
              onChange={(unit) => patch({ doseUnit: unit })}
            />
          </View>
        </View>

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">剂型</TextMuted>
        <SelectField
          value={draft.form}
          options={formOptions}
          onChange={(f) => {
            setFormTouched(true);
            patch({ form: f as FormKey });
          }}
        />

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">服用方式</TextMuted>
        <SelectField
          value={draft.method}
          options={METHODS.map((m) => ({ value: m, label: m }))}
          onChange={(method) => patch({ method })}
        />

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">使用频率</TextMuted>
        <View className="rounded-2xl border border-line bg-field p-3.5 dark:border-line-d dark:bg-field-d">
          <SelectField
            value={draft.mode}
            options={[
              { value: SPECIAL_MODE_ONCE, label: '一次性（单日内多次）' },
              { value: SPECIAL_MODE_WEEKLY, label: '每周 N 次' },
              { value: SPECIAL_MODE_DATES, label: '指定日期' },
            ]}
            onChange={(m) => patch({ mode: m as SpecialMode })}
          />

          {draft.mode === SPECIAL_MODE_ONCE ? (
            <>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[12.5px] text-muted dark:text-muted-d">日期</Text>
                <DateField value={draft.onceDate} onChange={(onceDate) => patch({ onceDate })} />
              </View>
              <Text className="mb-1.5 mt-3 text-[12.5px] font-medium text-muted dark:text-muted-d">
                当日时刻
              </Text>
              {draft.times.map((t, index) => {
                const parsed = parseTimeText(t) ?? { hour: 10, minute: 0 };
                return (
                  <View
                    key={`${index}-${t}`}
                    className="mt-1.5 flex-row items-center gap-2 rounded-[13px] border border-line bg-card p-2.5 dark:border-line-d dark:bg-card-d"
                  >
                    <TimeField
                      hour={parsed.hour}
                      minute={parsed.minute}
                      onChange={(h, m) => setTimeAt(index, h, m)}
                    />
                    <View className="flex-1" />
                    <Pressable
                      onPress={() => removeTimeAt(index)}
                      accessibilityLabel="删除时刻"
                      className="h-8 w-8 items-center justify-center rounded-[9px] bg-field active:opacity-70 dark:bg-field-d"
                    >
                      <Icon name="trash" size={15} color={color('muted')} />
                    </Pressable>
                  </View>
                );
              })}
              <Pressable
                onPress={() =>
                  patch({ times: [...draft.times, addHours(draft.times[draft.times.length - 1] ?? '10:00', 6)] })
                }
                className="mt-2 flex-row items-center gap-1 self-start rounded-full bg-card px-2.5 py-1.5 active:opacity-70 dark:bg-card-d"
              >
                <Icon name="add" size={13} color={color('muted')} />
                <Text className="text-[11.5px] text-muted dark:text-muted-d">添加</Text>
              </Pressable>
            </>
          ) : null}

          {draft.mode === SPECIAL_MODE_WEEKLY ? (
            <>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[12.5px] text-muted dark:text-muted-d">每周目标次数</Text>
                <NumericInput
                  value={draft.weeklyTarget}
                  onChangeText={(v) => patch({ weeklyTarget: v })}
                  accessibilityLabel="每周目标次数"
                  className="w-[64px] rounded-[10px] border border-line bg-card px-2 py-2 text-center text-[13px] text-ink dark:border-line-d dark:bg-card-d dark:text-ink-d"
                />
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[12.5px] text-muted dark:text-muted-d">提醒间隔</Text>
                <View className="flex-row items-center gap-1.5">
                  <NumericInput
                    value={draft.weeklyStepDays}
                    onChangeText={(v) => patch({ weeklyStepDays: v })}
                    accessibilityLabel="提醒间隔天数"
                    className="w-[64px] rounded-[10px] border border-line bg-card px-2 py-2 text-center text-[13px] text-ink dark:border-line-d dark:bg-card-d dark:text-ink-d"
                  />
                  <Text className="text-[12px] text-muted dark:text-muted-d">天</Text>
                </View>
              </View>
            </>
          ) : null}

          {draft.mode === SPECIAL_MODE_DATES ? (
            <>
              <Text className="mb-1.5 mt-3 text-[12.5px] font-medium text-muted dark:text-muted-d">
                日期
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {draft.dates.map((d) => (
                  <Chip
                    key={d}
                    label={dateKeyToCn(d)}
                    selected
                    onPress={() => patch({ dates: draft.dates.filter((x) => x !== d) })}
                  />
                ))}
              </View>
              <View className="mt-2 flex-row items-center gap-2">
                <DateField
                  value=""
                  placeholder="选择日期"
                  onChange={(d) => {
                    if (!draft.dates.includes(d)) patch({ dates: [...draft.dates, d].sort() });
                  }}
                />
              </View>
              <Text className="mb-1.5 mt-3 text-[12.5px] font-medium text-muted dark:text-muted-d">
                时刻
              </Text>
              {draft.times.map((t, index) => {
                const parsed = parseTimeText(t) ?? { hour: 10, minute: 0 };
                return (
                  <View
                    key={`${index}-${t}`}
                    className="mt-1.5 flex-row items-center gap-2 rounded-[13px] border border-line bg-card p-2.5 dark:border-line-d dark:bg-card-d"
                  >
                    <TimeField
                      hour={parsed.hour}
                      minute={parsed.minute}
                      onChange={(h, m) => setTimeAt(index, h, m)}
                    />
                    <View className="flex-1" />
                    <Pressable
                      onPress={() => removeTimeAt(index)}
                      accessibilityLabel="删除时刻"
                      className="h-8 w-8 items-center justify-center rounded-[9px] bg-field active:opacity-70 dark:bg-field-d"
                    >
                      <Icon name="trash" size={15} color={color('muted')} />
                    </Pressable>
                  </View>
                );
              })}
              <Pressable
                onPress={() =>
                  patch({ times: [...draft.times, addHours(draft.times[draft.times.length - 1] ?? '10:00', 6)] })
                }
                className="mt-2 flex-row items-center gap-1 self-start rounded-full bg-card px-2.5 py-1.5 active:opacity-70 dark:bg-card-d"
              >
                <Icon name="add" size={13} color={color('muted')} />
                <Text className="text-[11.5px] text-muted dark:text-muted-d">添加</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {editing && editing.records.length > 0 ? (
          <>
            <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">记录列表</TextMuted>
            <View className="rounded-2xl border border-line bg-card p-3.5 dark:border-line-d dark:bg-card-d">
              {editing.records.slice(-3).reverse().map((r) => (
                <View key={r.key} className="mt-1.5 first:mt-0">
                  <Text className="text-[12.5px] text-ink dark:text-ink-d">
                    {formatMonthDay(r.due)} {formatTime(r.due)} ·{' '}
                    {r.status === DOSE_TAKEN ? '已使用' : r.status === DOSE_SKIPPED ? '已跳过' : '待处理'}
                  </Text>
                </View>
              ))}
              {nextPreview ? (
                <Text className="mt-2 text-[11.5px] text-muted dark:text-muted-d">{nextPreview}</Text>
              ) : null}
            </View>
          </>
        ) : null}

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">备注</TextMuted>
        <Field value={draft.note} onChangeText={(v) => patch({ note: v })} placeholder="备注" multiline />

        <View className="mt-5 flex-row items-center gap-2">
          {!isNew && (
            <Pressable onPress={() => setConfirmDelete(true)} className="px-2 py-3 active:opacity-70">
              <Text className="text-[14px] font-medium text-danger dark:text-danger-d">删除</Text>
            </Pressable>
          )}
          <View className="flex-1" />
          <Pressable onPress={() => goBack()} className="px-3 py-3 active:opacity-70">
            <TextMuted className="text-[14px]">取消</TextMuted>
          </Pressable>
          <Pressable
            onPress={save}
            className="w-[112px] items-center rounded-2xl bg-violet py-3 active:opacity-80 dark:bg-violet-d"
          >
            <Text className="text-[15px] font-bold text-white dark:text-on-bright-d">保存</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="删除特殊用药"
        message={`确定删除「${editing?.name ?? ''}」吗？它的独立提醒也会取消。`}
        positiveLabel="删除"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </View>
  );
}
