import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SelectField } from '@/components/forms/SelectField';
import { NumericInput } from '@/components/forms/NumericInput';
import { TimeField } from '@/components/forms/TimeField';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Pill';
import { WeekdayPicker } from './WeekdayPicker';
import {
  PlanPreview,
  PlanSlotRow,
  addPlanSlot,
  removePlanSlot,
  updatePlanSlot,
} from './PlanSlotRow';
import {
  ALL_WEEKDAYS_MASK,
  MAX_INTERVAL_HOURS,
  MIN_INTERVAL_HOURS,
} from '@/constants/plan';
import { createTemplatePlan, templateName, type MealTiming } from '@/lib/plan-template';
import { genId } from '@/utils/id';
import { useTheme } from '@/lib/theme';
import type { PlanSlot, PlanType, SchedulePlan, SavedPlan } from '@/lib/types';

function defaultSlot(unit: string) {
  return { id: genId(), hour: 8, minute: 0, label: '', qty: '', unit };
}

export function PlanEditor({
  value,
  medQty,
  medUnit,
  onChange,
  onSaveTemplate,
}: {
  value: SchedulePlan;
  medQty: string;
  medUnit: string;
  onChange: (plan: SchedulePlan) => void;
  onSaveTemplate: (name: string, plan: SchedulePlan) => void;
}) {
  const { color } = useTheme();
  const [meal, setMeal] = useState<MealTiming>('after');
  const [templateNameText, setTemplateNameText] = useState('');

  const setType = (type: PlanType) => {
    if (type === value.type) return;
    if (type === 'interval') {
      onChange({
        type: 'interval',
        intervalHours: 6,
        dosesPerDay: 3,
        firstTime: { hour: 8, minute: 0 },
      });
      return;
    }
    const slots = value.type === 'interval' ? [defaultSlot(medUnit)] : value.slots;
    if (type === 'weekly') {
      onChange({ type: 'weekly', daysMask: ALL_WEEKDAYS_MASK, slots });
    } else {
      onChange({ type: 'daily', slots });
    }
  };

  const applyTemplate = (count: 1 | 2 | 3) => {
    const plan = createTemplatePlan(count, meal, genId);
    onChange({
      ...plan,
      slots: plan.slots.map((s) => ({ ...s, unit: s.unit || medUnit })),
    });
  };

  const updateSlots = (next: PlanSlot[]) => {
    if (value.type === 'interval') return;
    onChange({ ...value, slots: next });
  };

  return (
    <View>
      <View className="mb-1.5">
        <SelectField
          title="计划类型"
          testID="plan-type"
          value={value.type}
          options={[
            { value: 'daily', label: '每天固定' },
            { value: 'weekly', label: '按周循环' },
            { value: 'interval', label: '按间隔' },
          ]}
          onChange={(t) => setType(t as PlanType)}
        />
      </View>

      {value.type !== 'interval' ? (
        <>
          <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
            <Text className="text-[12px] font-medium text-muted dark:text-muted-d">模板</Text>
            <Chip label="每日一次" onPress={() => applyTemplate(1)} />
            <Chip label="每日两次" onPress={() => applyTemplate(2)} />
            <Chip label="每日三次" onPress={() => applyTemplate(3)} />
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="w-[104px]">
              <SelectField
                title="服药时机"
                testID="plan-meal"
                value={meal}
                options={[
                  { value: 'after', label: '饭后' },
                  { value: 'before', label: '饭前' },
                ]}
                onChange={(m) => setMeal(m as MealTiming)}
              />
            </View>
          </View>

          {value.type === 'weekly' ? (
            <View className="mt-3">
              <Text className="mb-1.5 text-[12px] font-medium text-muted dark:text-muted-d">
                生效日
              </Text>
              <WeekdayPicker
                value={value.daysMask}
                onChange={(daysMask) => onChange({ ...value, daysMask })}
              />
            </View>
          ) : null}

          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] font-medium text-muted dark:text-muted-d">
              时刻与用量
            </Text>
            <Pressable
              testID="plan-add-slot"
              onPress={() => updateSlots(addPlanSlot(value.slots, medUnit, genId))}
              className="flex-row items-center gap-1 rounded-full bg-field px-2.5 py-1.5 active:opacity-70 dark:bg-field-d"
            >
              <Icon name="add" size={13} color={color('muted')} />
              <Text className="text-[11.5px] font-medium text-muted dark:text-muted-d">添加</Text>
            </Pressable>
          </View>

          {value.slots.map((slot, index) => (
            <PlanSlotRow
              key={slot.id}
              slot={slot}
              medUnit={medUnit}
              index={index}
              canRemove={value.slots.length > 1}
              onChange={(patch) => updateSlots(updatePlanSlot(value.slots, slot.id, patch))}
              onRemove={() => updateSlots(removePlanSlot(value.slots, slot.id))}
            />
          ))}

          <View className="mt-3 flex-row items-center gap-2">
            <NumericInput
              testID="plan-template-name"
              value={templateNameText}
              onChangeText={setTemplateNameText}
              placeholder={templateName(3, meal)}
              className="flex-1 rounded-[12px] border border-line bg-field px-3 py-2.5 text-[13px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d"
            />
            <Pressable
              onPress={() => {
                onSaveTemplate(templateNameText.trim() || templateName(3, meal), value);
                setTemplateNameText('');
              }}
              className="rounded-[12px] bg-field px-3 py-2.5 active:opacity-70 dark:bg-field-d"
            >
              <Text className="text-[12px] font-medium text-muted dark:text-muted-d">存为模板</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] font-medium text-muted dark:text-muted-d">服药间隔</Text>
            <View className="flex-row items-center gap-1.5">
              <NumericInput
                value={String(value.intervalHours)}
                onChangeText={(v) => {
                  const n = Number(v);
                  onChange({
                    ...value,
                    intervalHours: Number.isFinite(n)
                      ? Math.max(MIN_INTERVAL_HOURS, Math.min(MAX_INTERVAL_HOURS, n))
                      : MIN_INTERVAL_HOURS,
                  });
                }}
                accessibilityLabel="间隔小时数"
                className="w-[64px] rounded-[10px] border border-line bg-field px-2 py-2 text-center text-[13px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d"
              />
              <Text className="text-[12px] text-muted dark:text-muted-d">小时</Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] font-medium text-muted dark:text-muted-d">每天次数</Text>
            <NumericInput
              value={String(value.dosesPerDay)}
              onChangeText={(v) => {
                const n = Number(v);
                onChange({
                  ...value,
                  dosesPerDay: Number.isFinite(n) ? Math.max(1, Math.min(12, n)) : 1,
                });
              }}
              accessibilityLabel="每天次数"
              className="w-[64px] rounded-[10px] border border-line bg-field px-2 py-2 text-center text-[13px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d"
            />
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] font-medium text-muted dark:text-muted-d">首剂时间</Text>
            <TimeField
              hour={value.firstTime.hour}
              minute={value.firstTime.minute}
              onChange={(hour, minute) => onChange({ ...value, firstTime: { hour, minute } })}
            />
          </View>
        </>
      )}

      <PlanPreview plan={value} medQty={medQty} medUnit={medUnit} />
    </View>
  );
}
