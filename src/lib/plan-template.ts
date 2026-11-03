/**
 * 默认计划模板与复制语义。
 *
 * 模板应用是动作：生成新的槽位（新 id），不与模板联动。
 */

import { MEAL_BEFORE_OFFSET_MIN, TEMPLATE_BASE_TIMES } from '../constants/plan';
import type { DailyPlan, PlanSlot, SchedulePlan } from './types';
import { genId } from '../utils/id';

export type MealTiming = 'after' | 'before';

const SLOT_LABELS: Record<1 | 2 | 3, string[]> = {
  1: ['早'],
  2: ['早', '晚'],
  3: ['早', '中', '晚'],
};

export function templateName(count: 1 | 2 | 3, meal: MealTiming): string {
  const cn = count === 1 ? '一' : count === 2 ? '两' : '三';
  return `每日${cn}次 · ${meal === 'before' ? '饭前' : '饭后'}`;
}

/** 饭前在基准时刻上前移 30 分钟。 */
export function applyMealTiming(
  hour: number,
  minute: number,
  meal: MealTiming
): { hour: number; minute: number } {
  if (meal === 'after') return { hour, minute };
  let m = minute - MEAL_BEFORE_OFFSET_MIN;
  let h = hour;
  if (m < 0) {
    m += 60;
    h = (h + 23) % 24;
  }
  return { hour: h, minute: m };
}

/** 生成内置模板计划（带新槽位 id）。 */
export function createTemplatePlan(
  count: 1 | 2 | 3,
  meal: MealTiming,
  idFactory: () => string = genId
): DailyPlan {
  const suffixes = SLOT_LABELS[count];
  const times = TEMPLATE_BASE_TIMES[count];
  const slots: PlanSlot[] = times.map((t, index) => {
    const adjusted = applyMealTiming(t.hour, t.minute, meal);
    return {
      id: idFactory(),
      hour: adjusted.hour,
      minute: adjusted.minute,
      label: `${suffixes[index]} · ${meal === 'before' ? '饭前' : '饭后'}`,
      qty: '',
      unit: '',
    };
  });
  return { type: 'daily', slots };
}

/** 复制计划并重新生成槽位 id（模板应用/复制药物时使用）。 */
export function clonePlanWithNewIds(plan: SchedulePlan, idFactory: () => string = genId): SchedulePlan {
  if (plan.type === 'interval') return { ...plan, firstTime: { ...plan.firstTime } };
  return {
    ...plan,
    slots: plan.slots.map((slot) => ({ ...slot, id: idFactory() })),
  };
}
