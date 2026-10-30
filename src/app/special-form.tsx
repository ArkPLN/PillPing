import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { FormPicker } from '@/components/forms/FormPicker';
import { ConfirmDialog } from '@/components/forms/Dialogs';
import { HeaderIconButton, PageHeader } from '@/components/home/Header';
import { Chip } from '@/components/ui/Pill';
import { Field } from '@/components/ui/Field';
import { Medium, TextMuted } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { inferForm } from '@/lib/forms';
import { FORM_LABELS, type FormKey } from '@/lib/icons';
import { computeNext, scheduleText } from '@/lib/specialmed';
import { formatMonthDay, formatTime } from '@/lib/format';
import { buildSchedulerInput } from '@/lib/notifications/input';
import { syncAll } from '@/lib/notifications/scheduler';
import type { SpecialMed } from '@/lib/types';
import { METHODS, SPECIAL_MODE_DAILY, SPECIAL_MODE_INTERVAL, type SpecialMode } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/lib/theme';

type Draft = {
  name: string;
  dose: string;
  form: FormKey;
  method: string;
  note: string;
  mode: SpecialMode;
  intervalHours: number;
  hour: number;
  minute: number;
};

function formKeyOf(form: string): FormKey {
  const entry = (Object.keys(FORM_LABELS) as FormKey[]).find((k) => FORM_LABELS[k] === form);
  return entry ?? 'tablet';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export default function SpecialFormScreen() {
  const router = useRouter();
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
        dose: editing.dose,
        form: formKeyOf(editing.form),
        method: editing.method,
        note: editing.note,
        mode: editing.mode,
        intervalHours: editing.intervalHours,
        hour: editing.hour,
        minute: editing.minute,
      };
    }
    return {
      name: '',
      dose: '',
      form: 'tablet',
      method: '口服',
      note: '',
      mode: SPECIAL_MODE_INTERVAL,
      intervalHours: 8,
      hour: 21,
      minute: 0,
    };
  });

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);

  const [formTouched, setFormTouched] = useState(false);
  const autoForm = useCallback(() => {
    if (formTouched) return;
    const key = formKeyOf(inferForm(draft.name, draft.dose, draft.method));
    if (key !== draft.form) patch({ form: key });
  }, [draft.name, draft.dose, draft.method, draft.form, formTouched, patch]);

  React.useEffect(() => {
    autoForm();
  }, [autoForm]);

  // 下次提醒预览
  const previewText = useMemo(() => {
    const probe: SpecialMed = {
      id: 'preview',
      code: 0,
      name: draft.name,
      dose: draft.dose,
      method: draft.method,
      form: FORM_LABELS[draft.form],
      note: draft.note,
      enabled: true,
      mode: draft.mode,
      intervalHours: draft.intervalHours,
      hour: draft.hour,
      minute: draft.minute,
      nextAt: 0,
      lastAt: 0,
      snoozeUntil: 0,
    };
    const from = draft.mode === SPECIAL_MODE_INTERVAL && editing?.lastAt ? editing.lastAt : Date.now();
    const next = computeNext(probe, from);
    return `下一次提醒：${formatMonthDay(next)} ${formatTime(next)}`;
  }, [draft, editing]);

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

    const changed =
      isNew ||
      !editing ||
      editing.mode !== draft.mode ||
      editing.intervalHours !== draft.intervalHours ||
      editing.hour !== draft.hour ||
      editing.minute !== draft.minute;

    const probe: SpecialMed = {
      id: editing?.id ?? '',
      code: editing?.code ?? 0,
      name,
      dose,
      method: draft.method,
      form: FORM_LABELS[draft.form],
      note: draft.note.trim(),
      enabled: editing?.enabled ?? true,
      mode: draft.mode,
      intervalHours: draft.intervalHours,
      hour: draft.hour,
      minute: draft.minute,
      nextAt: editing?.nextAt ?? 0,
      lastAt: editing?.lastAt ?? 0,
      snoozeUntil: editing?.snoozeUntil ?? 0,
    };

    if (changed) {
      const from = isNew
        ? Date.now()
        : draft.mode === SPECIAL_MODE_INTERVAL && probe.lastAt > 0
          ? probe.lastAt
          : Date.now();
      probe.nextAt = computeNext(probe, from);
      probe.snoozeUntil = 0;
    }

    if (isNew) {
      addSpecial({ ...probe, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    } else {
      updateSpecial(probe);
    }

    (async () => {
      await syncAll(buildSchedulerInput());
      router.back();
    })();
  }, [draft, editing, isNew, addSpecial, updateSpecial, router]);

  const doDelete = useCallback(async () => {
    if (!editing) return;
    removeSpecial(editing.id);
    setConfirmDelete(false);
    await syncAll(buildSchedulerInput());
    router.back();
  }, [editing, removeSpecial, router]);

  return (
    <View className="flex-1 bg-bg dark:bg-bg-d" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-7"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={isNew ? '添加特殊用药' : '编辑特殊用药'}
          subtitle="特殊用药有独立的提醒节奏，不计入普通药物的今日次数。"
          action={
            <HeaderIconButton accessibilityLabel="返回" onPress={() => router.back()}>
              <Icon name="close" size={20} color={color('muted')} />
            </HeaderIconButton>
          }
        />

        <TextMuted className="mb-1.5 mt-4 text-[12.5px] font-medium">药名</TextMuted>
        <Field
          value={draft.name}
          onChangeText={(v) => patch({ name: v })}
          placeholder="例如：某特殊药"
        />

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">每次用量</TextMuted>
        <Field
          value={draft.dose}
          onChangeText={(v) => patch({ dose: v })}
          placeholder="例如：1片 / 5ml"
        />

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">剂型</TextMuted>
        <FormPicker
          value={draft.form}
          onChange={(f) => {
            setFormTouched(true);
            patch({ form: f });
          }}
        />

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

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">服用节奏</TextMuted>
        <View className="flex-row flex-wrap gap-1.5">
          <Chip
            label="按间隔"
            selected={draft.mode === SPECIAL_MODE_INTERVAL}
            onPress={() => patch({ mode: SPECIAL_MODE_INTERVAL })}
          />
          <Chip
            label="每天固定时间"
            selected={draft.mode === SPECIAL_MODE_DAILY}
            onPress={() => patch({ mode: SPECIAL_MODE_DAILY })}
          />
        </View>

        {draft.mode === SPECIAL_MODE_INTERVAL ? (
          <View className="mt-2 rounded-2xl border border-line bg-card p-3.5 dark:border-line-d dark:bg-card-d">
            <View className="flex-row flex-wrap items-center">
              <View className="flex-1 pr-2">
                <Medium className="text-[13.5px]">每隔多久提醒</Medium>
                <TextMuted className="mt-0.5 text-[11px]">从上一次实际服用时间开始计算</TextMuted>
              </View>
              <View className="flex-row items-center">
                <Pressable
                  onPress={() => patch({ intervalHours: Math.max(1, draft.intervalHours - 1) })}
                  className="h-9 w-9 items-center justify-center rounded-full bg-field active:opacity-70 dark:bg-field-d"
                >
                  <Text className="text-[18px] text-violet dark:text-violet-d">−</Text>
                </Pressable>
                <View className="min-w-[62px] items-center">
                  <Text className="text-[14px] font-bold text-violet dark:text-violet-d">
                    {draft.intervalHours} 小时
                  </Text>
                </View>
                <Pressable
                  onPress={() => patch({ intervalHours: Math.min(72, draft.intervalHours + 1) })}
                  className="h-9 w-9 items-center justify-center rounded-full bg-field active:opacity-70 dark:bg-field-d"
                >
                  <Text className="text-[18px] text-violet dark:text-violet-d">+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowTimePicker(true)}
            className="mt-2 flex-row items-center rounded-2xl border border-line bg-card p-3.5 active:opacity-80 dark:border-line-d dark:bg-card-d"
          >
            <View className="flex-1">
              <Medium className="text-[13.5px]">每天提醒时间</Medium>
              <TextMuted className="mt-0.5 text-[11px]">每天这个时间提醒一次</TextMuted>
            </View>
            <Text className="text-[15px] font-bold text-violet dark:text-violet-d">
              {pad2(draft.hour)}:{pad2(draft.minute)}
            </Text>
            <Text className="ml-1 text-[12px] font-medium text-primary dark:text-primary-d">修改</Text>
          </Pressable>
        )}

        {/* 预览 */}
        <View className="mt-2.5 rounded-[14px] bg-violet-bg p-3.5 dark:bg-violet-bg-d">
          <Text className="text-[12px] font-medium text-violet-text dark:text-violet-text-d">
            {previewText}
          </Text>
          <Text className="mt-1 text-[11px] text-violet-text/80 dark:text-violet-text-d/80">
            节奏：{scheduleText({
              id: 'p',
              code: 0,
              name: '',
              dose: '',
              method: '',
              form: '',
              note: '',
              enabled: true,
              mode: draft.mode,
              intervalHours: draft.intervalHours,
              hour: draft.hour,
              minute: draft.minute,
              nextAt: 0,
              lastAt: 0,
              snoozeUntil: 0,
            })}
          </Text>
        </View>

        <TextMuted className="mb-1.5 mt-3.5 text-[12.5px] font-medium">备注（可选）</TextMuted>
        <Field
          value={draft.note}
          onChangeText={(v) => patch({ note: v })}
          placeholder="例如：睡前服用 / 不要和某药同服"
          multiline
        />

        <View className="mt-5 flex-row items-center gap-2">
          {!isNew && (
            <Pressable onPress={() => setConfirmDelete(true)} className="px-2 py-3 active:opacity-70">
              <Text className="text-[14px] font-medium text-danger dark:text-danger-d">删除</Text>
            </Pressable>
          )}
          <View className="flex-1" />
          <Pressable onPress={() => router.back()} className="px-3 py-3 active:opacity-70">
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

      {showTimePicker && (
        <DateTimePicker
          value={new Date(2026, 0, 1, draft.hour, draft.minute)}
          mode="time"
          is24Hour
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (event.type === 'set' && date) {
              patch({ hour: date.getHours(), minute: date.getMinutes() });
            }
          }}
        />
      )}

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
