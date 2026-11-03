# Tasks

## 1. 常量与工具归结（先行，供后续任务引用）

- [x] 1.1 新建 `src/constants/time.ts`（`MINUTE_MS` / `HOUR_MS` / `DAY_MS`），删除 `cycle.ts` 与 `specialmed.ts` 的重复 `HOUR_MS` 定义，`med.ts` / `med-form.tsx` / `response.ts` / `format.ts` / `useStore.ts` 的裸毫秒数换为常量；`yarn typecheck && yarn test` 通过
- [x] 1.2 新建 `src/constants/thresholds.ts`（补登确认阈值、到点宽限窗口），`dose.tsx` / `useHomeActions.ts`（30 分钟）与 `dose.tsx` / `Hero.tsx` / `HomeCards.tsx` / `SpecialCard.tsx`（60 秒）换用；`grep -rn "30 \* 60\|< 60_000" src` 无残留
- [x] 1.3 新建 `src/utils/number.ts`（`pad2`）、`src/utils/datetime.ts`（`startOfDay` / `startOfToday`）、`src/utils/id.ts`（ID 生成）：三处 `pad2` 实现与两处手写 `padStart` 收敛、`format.ts`/`repair.ts` 的 `startOfDay` 去重、`med-form.tsx`/`special-form.tsx` 的 ID 模板收敛；`yarn test` 通过
- [x] 1.4 `utils/` 分层红线确认：任一文件无 `import ... from '@/lib` 或 `@/store`；`grep -rn "@/'" src/utils | grep -E "lib|store"` 零命中
- [x] 1.5 注释与类型注解检查：constants 下每个常量有注释+类型注解、utils 下每个函数有 JSDoc（陈述原始语义，含参数/返回值）且无无关解读；逐文件人工过一遍
- [x] 1.6 `scheduler.ts` 的 identifier 前缀语义化（常量单点维护）、硬编码色 `#7C3AED`/`#B45309` 改走 `COLORS` token；`yarn test` 通过且通知排定/取消配对正常（真机手测一次推迟）

## 2. 派生内核（cycle.ts）

- [x] 2.1 在 `src/lib/cycle.ts` 新增纯函数 `projectPlanned(cycle, intervalHours): number[]`，合并 `projectPendingFromLastTaken` 与 `rescheduleAfterTaken` 的共同内核（锚点 = 最近实际服用，未开始时返回空数组，跳过槽位参与派生但不写锚点——见 design D9），并让两者内部改为调用它；`yarn test src/lib/__tests__/cycle.test.ts` 通过
- [x] 2.2 测试锚点切换（design D1 修订）：`startedCycle` 工厂与全部 `c.planned[i]` 直读断言改为对 `projectPlanned()` 派生结果断言，legacy 三案例期望数值不变；跳过用例改断言派生值 13:00；`yarn test` 通过
- [x] 2.3 补 `undo` 回退用例：撤销第 2 次服用记录后，第 2/3 次派生回退为 13:00/18:00（对齐 spec 新增 scenario）；`yarn test` 通过
- [x] 2.4 新增 `plannedAt(cycle, interval, i): number`（单点读取，含 `isStarted` 守卫，未开始返回 0）；`yarn typecheck` 通过

## 3. Store 接线（useStore.ts）

- [x] 3.1 `startCycle` / `setInterval` / `setDoseCount` / `markTakenAt` / `undo` / `snooze` / `skip` 中全部停止维护 `cycle.planned`（D9 派生模型下 skip 也无需写计划），新增 `selectPlanned` selector 供组件订阅；`yarn test` 全量通过
- [x] 3.2 `partialize` 移除 `planned` 写出、`merge` 对旧数据 `planned` 忽略（不迁移、`version: 1` 不动）；在 `repair.test.ts` 补一条"旧数据含不一致 planned 时以派生为准"的用例并确认通过

## 4. 语义封装收敛

- [x] 4.1 新建 `src/lib/effective.ts` 导出 `effectiveDue(snoozeUntil, scheduled)`（位置参数，design D3 修订），`cycle.ts:effectiveTime` 与 `specialmed.ts:effectiveAt` 改为薄别名；现有调用点不改；`yarn test` 通过
- [x] 4.2 `useStore` 的 `markTakenAt`/`markSpecialTaken`/`snooze`/`snoozeSpecial` 换用 `utils` 的时刻钳制函数；`yarn typecheck && yarn test` 通过

## 5. 消费方切换（5 处读取点）

- [x] 5.1 `src/lib/day.ts`：`shouldStartNewDay` / `currentDue` 改走派生函数；`yarn test` 通过
- [x] 5.2 `src/lib/notifications/scheduler.ts`：`cycle.planned` 读取改派生，date trigger 时刻与派生一致；`yarn test` 通过
- [x] 5.3 `src/app/dose.tsx`、`src/lib/useHomeActions.ts`、`src/app/time-picker.tsx`：`planned[i]` 读取全部改 selector/`plannedAt`；`yarn typecheck` 通过且页面无 console error（`npx expo run:android` 手测主页与详情页）

## 6. 秒级精度

- [x] 6.1 `src/lib/firstAt.ts` 删除 `roundToMinute`（`ensure` 直接 `Date.now()`），time-picker 补登初始值逻辑随之保留毫秒精度；`yarn test` 通过
- [x] 6.2 确认呈现层文案不变：`format.ts` 的 `HH:mm` 系列输出零 diff；倒计时如需秒差走既有 `formatDuration`；`yarn test` + 手测主页文案为 HH:mm

## 7. 收尾验证

- [x] 7.1 `yarn typecheck && yarn test` 全绿；`npx expo-doctor` 无新增告警
- [ ] 7.2 Android 真机/模拟器回归：开始新周期 → 改间隔 → 推迟 → 补登，通知到点与页面显示秒级一致、文案仍 HH:mm
