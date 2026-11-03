import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SelectField } from '@/components/forms/SelectField';
import { NumericInput } from '@/components/forms/NumericInput';
import { TimeField } from '@/components/forms/TimeField';
import { Icon } from '@/components/ui/Icon';
import { SLOT_LABELS } from '@/constants/plan';
import { UNITS } from '@/lib/units';
import { pad2 } from '@/utils/number';
import { useTheme } from '@/lib/theme';
import type { PlanSlot } from '@/lib/types';

export function PlanSlotRow({
  slot,
  medUnit,
  index,
  canRemove = true,
  onChange,
  onRemove,
}: {
  slot: PlanSlot;
  medUnit: string;
  index: number;
  canRemove?: boolean;
  onChange: (patch: Partial<PlanSlot>) => void;
  onRemove: () => void;
}) {
  const { color } = useTheme();
  return (
    <View className="mt-2 flex-row items-center gap-1 rounded-[13px] border border-line bg-card p-2 dark:border-line-d dark:bg-card-d">
      <TimeField
        variant="compact"
        testID={`plan-slot-${index}-time`}
        hour={slot.hour}
        minute={slot.minute}
        onChange={(hour, minute) => onChange({ hour, minute })}
      />
      <View className="min-w-0 flex-1">
        <SelectField
          variant="compact"
          title="时段标注"
          testID={`plan-slot-${index}-label`}
          value={slot.label ?? ''}
          displayValue={slot.label ? slot.label.split(' · ')[0] : undefined}
          options={[
            { value: '', label: '未标注' },
            ...SLOT_LABELS.map((l) => ({ value: l, label: l })),
          ]}
          onChange={(label) => onChange({ label })}
        />
      </View>
      <NumericInput
        testID={`plan-slot-${index}-qty`}
        maxFontSizeMultiplier={1.2}
        value={slot.qty ?? ''}
        onChangeText={(qty) => onChange({ qty })}
        placeholder="继承"
        accessibilityLabel="数量"
        className="min-h-[34px] w-[40px] rounded-[9px] border border-line bg-field px-1 py-1.5 text-center text-[12.5px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d"
      />
      <View className="w-[56px]">
        <SelectField
          variant="compact"
          columns={4}
          title="单位"
          testID={`plan-slot-${index}-unit`}
          value={slot.unit || medUnit}
          options={UNITS.map((u) => ({ value: u, label: u }))}
          onChange={(unit) => onChange({ unit })}
        />
      </View>
      <Pressable
        onPress={onRemove}
        disabled={!canRemove}
        accessibilityRole="button"
        accessibilityLabel="删除时刻"
        accessibilityState={{ disabled: !canRemove }}
        testID={`plan-slot-${index}-remove`}
        className={`h-8 w-8 items-center justify-center rounded-[9px] bg-field active:opacity-70 dark:bg-field-d ${
          canRemove ? '' : 'opacity-40'
        }`}
      >
        <Icon name="trash" size={14} color={color('muted')} />
      </Pressable>
    </View>
  );
}

export function slotTimeText(slot: PlanSlot): string {
  return `${pad2(slot.hour)}:${pad2(slot.minute)}`;
}

export function slotLabelText(slot: PlanSlot): string {
  return slot.label ? ` · ${slot.label}` : '';
}

export function addPlanSlot(slots: PlanSlot[], medUnit: string, idFactory: () => string): PlanSlot[] {
  const last = slots[slots.length - 1];
  const hour = last ? (last.hour + 4) % 24 : 8;
  return [
    ...slots,
    { id: idFactory(), hour, minute: 0, label: '', qty: '', unit: medUnit },
  ];
}

export function updatePlanSlot(slots: PlanSlot[], id: string, patch: Partial<PlanSlot>): PlanSlot[] {
  return slots.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function removePlanSlot(slots: PlanSlot[], id: string): PlanSlot[] {
  if (slots.length <= 1) return slots;
  return slots.filter((s) => s.id !== id);
}

export function PlanPreview({
  plan,
  medQty,
  medUnit,
}: {
  plan: import('@/lib/types').SchedulePlan;
  medQty: string;
  medUnit: string;
}) {
  if (plan.type === 'interval') {
    return (
      <View className="mt-2.5 rounded-[14px] bg-mint px-3.5 py-3 dark:bg-mint-d">
        <Text className="text-[12.5px] font-medium text-primary dark:text-primary-d">
          每 {plan.intervalHours} 小时 · 每天 {plan.dosesPerDay} 次
        </Text>
        <Text className="mt-1 text-[11.5px] text-primary/80 dark:text-primary-d/80">
          首剂 {pad2(plan.firstTime.hour)}:{pad2(plan.firstTime.minute)}，之后按实际服用顺延
        </Text>
      </View>
    );
  }

  const slots = plan.slots
    .slice()
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const daysText =
    plan.type === 'weekly'
      ? Array.from({ length: 7 })
          .map((_, i) => (((plan.daysMask >>> i) & 1) === 1 ? `周${'一二三四五六日'[i]}` : null))
          .filter(Boolean)
          .join('、')
      : '';

  return (
    <View className="mt-2.5 rounded-[14px] bg-mint px-3.5 py-3 dark:bg-mint-d">
      <Text className="text-[12px] font-semibold text-primary dark:text-primary-d">
        {plan.type === 'weekly' ? `按周循环 · ${daysText || '未选择'}` : '每天固定'}
      </Text>
      <View className="mt-1.5 gap-1">
        {slots.map((slot) => {
          const qty = (slot.qty ?? '').trim() || medQty;
          const unit = slot.unit || medUnit;
          return (
            <Text
              key={slot.id}
              className="text-[12.5px] text-primary dark:text-primary-d"
            >
              {pad2(slot.hour)}:{pad2(slot.minute)}  {qty}
              {unit}
              {slot.label ? ` · ${slot.label}` : ''}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
