# Design

## Context

现状（代码事实，`src/lib/` 为准）：

- `Cycle.planned: number[]` 随 zustand persist 整体写进 AsyncStorage（`medtimer_data`），同时有四个写入来源：`startCycle`（`first + i*interval`）、`setInterval`/`setDoseCount`/`undo`（`projectPendingFromLastTaken`）、`markTakenAt`（`rescheduleAfterTaken`）、`repairState`（无 snooze 时重投影）。读取点 5 处：`day.ts`、`scheduler.ts`、`dose.tsx`、`useHomeActions.ts`、`time-picker.tsx`。
- "推迟优先"语义重复两份：`cycle.ts:effectiveTime(cycle, i)` 与 `specialmed.ts:effectiveAt(m)`。
- "补登时刻钳制"重复两份：`markTakenAt` 与 `markSpecialTaken` 里的 `Math.min(atMillis, now)`。
- 分钟取整一处：`firstAt.ts:roundToMinute`；补登入口 `time-picker.tsx` 用 `mode="time"`（分钟粒度），初始值取 `Math.min(now, planned)`。
- 字段名与 legacy JSON key 对齐是硬约束（AGENTS.md）；`cycle.test.ts`（193 行）钉住链式规则三示例。

## Goals / Non-Goals

**Goals:**

- `planned` 从"持久化状态"降级为"纯派生视图"，全库单一推导入口。
- 同语义函数收敛：到点时间、时刻钳制、pad2。
- 内部时间戳去掉分钟取整，保留秒级精度；用户可见 `HH:mm` 文案不动。
- `cycle.test.ts` 三示例不改断言继续通过（改的只是数据来源）。

**Non-Goals:**

- 不做旧数据迁移（旧 `planned` 字段直接忽略）。
- 不改 legacy JSON key 命名（`slotMask`/`actedAt`/`snoozeUntil` 等原样保留）。
- 不引入响应式第三方库（不 RxDB/immer 之类），zustand 自身能力足够。
- 不改 `SpecialMed` 调度语义与复诊调度策略。

## Decisions

### D1. planned 派生为纯函数 + store selector，Cycle 结构字段保留但置空

- `cycle.ts` 提供唯一派生函数 `projectPlanned(cycle: Cycle, intervalHours: number): number[]`，合并现 `projectPendingFromLastTaken` 与 `rescheduleAfterTaken` 的共同内核（两者本来就同构：找锚点 → 从锚点后逐个写 `base + (j-anchor)*step`）。
- `Cycle` 类型上保留 `planned: number[]` 字段（**兼容期写空数组**），而不是立即从类型删除——原因是 `time-picker.tsx`、`dose.tsx` 等 5 处读取点分批切换，一次删类型会扩大单次 diff。派生 selector：
  ```ts
  // src/lib/cycle.ts
  export function plannedAt(cycle: Cycle, interval: number, i: number): number
  // src/store/useStore.ts
  export const selectPlanned: (s: AppState) => (i: number) => number
  ```
- 消费方统一走 `plannedAt` / `selectPlanned`，不再读 `cycle.planned[i]`。全部切完后 `partialize` 与 `repair.ts` 不再接触 `planned`。
- **测试锚点随之切换（verify C1/W2 修订）**：`cycle.test.ts` 的 `startedCycle` 工厂与各用例改为**从派生函数断言**（`projectPlanned()` 的输出），legacy 三案例的期望数值（13:00 / 19:00 / 次日 01:30）不变，但断言来源从"读 `c.planned[i]`"换成"读派生结果"——否则测试只验证旧内核、不验证派生路径，回归无证明力。跳过语义（C1 决策 A）在同一批测试中钉住：跳过槽位参与派生、不写锚点。
- 备选：删掉 `planned` 字段 + Proxy 动态计算 —— 拒绝，Proxy 隐式行为伤可读性，且和 zustand persist 的浅合并模型不合。
- 备选：保留持久化但启动时校验 —— 拒绝，这正是"两份真相"的根因。

### D2. 旧数据兼容：读侧忽略、写侧不再写出，不迁移

- `merge`/`repairState` 对持久化进来的 `planned` 不做任何事（不校验、不修补），派生函数每次从 `firstAt`/`actedAt`/`interval` 现算。
- 旧数据里 `planned` 与链式规则不一致的场景（改过间隔、补登过）切换后以规则为准——这正是修复逻辑本来的意图（`repair.ts` 里 `projectPendingFromLastTaken` 干的就是这件事），所以行为上是收敛而非漂移。
- AsyncStorage 的 `version: 1` 保持不动，不升版本。

### D3. 同语义封装收敛到两个工具文件

- `src/lib/effective.ts`（新）：`effectiveDue(snoozeUntil: number, scheduled: number): number` —— "推迟优先"唯一实现，用位置参数（verify S1：对象参数形态对两个薄别名而言多一层无谓包装）；`cycle.ts:effectiveTime`、`specialmed.ts:effectiveAt` 改为内部调用它（两个薄别名保留，避免一次性改 8+ 调用点）。
- 时刻钳制 `clampAt`、`pad2` 归 `src/utils/`（见 D7），不落在 lib。

### D9. 跳过槽位的派生语义（verify C1 决策 A）

- **决策 A：跳过槽位参与派生**。锚定规则只由 `actedAt`（实际服用）触发——跳过不写锚点，所以"跳过不重排后续"的 legacy 行为天然保持；而跳过槽位自身的计划时刻也由锚点链派生得出，不存在"保留旧计划值"的特例。
- 派生算法统一为：找到最近 `DOSE_TAKEN` 的 `actedAt` 锚点（无则 `firstAt`），其后**所有**槽位（pending/skipped）按 `base + (j-anchor)*step` 写计划；已服用槽位只保留 `actedAt`，其计划值虽也被派生覆盖但到点计算从不使用它。
- `cycle.test.ts` 中"跳过的次数保留原计划时间"用例（`cycle.test.ts:119-123`）改为断言派生值 13:00（数值碰巧与旧持久化值一致，因为跳过不产生新锚点、锚点链未变）——这正是决策 A 与 legacy 行为兼容的原因：只要锚点链不被跳过改变，派生值与旧持久化值在无历史修正的数据上等价；有历史修正（改过间隔）时以派生为准，符合 Requirement 1 的唯一来源条款。
- 备选（决策 B）：跳过槽位冻结投影快照 —— 拒绝，需要持久化派生快照，与"不再持久化 planned"矛盾。

### D4. 秒级精度：删除 roundToMinute，计算链路不动，呈现层守门

- 内部：`firstAt.ts` 删 `roundToMinute`，`useFirstAt.ensure` 直接 `Date.now()`；`time-picker.tsx` 补登初始值不再影响精度（`mode="time"` 控件本身仍分钟粒度，这是 UI 控件限制，非系统精度限制——用户没动秒之前保持控件原值）。
- 计算：`projectPlanned` / `computeNext` 全是毫秒算术，无取整点，天然支持秒级。
- 呈现：`format.ts` 的 `HH:mm` 文案一律不改（AGENTS.md 硬规则：中文文案逐字对齐 legacy）。倒计时场景如需秒差，走已有的 `formatDuration`（已输出「X 分 Y 秒」），不新增文案函数。
- 通知 `scheduler.ts` 的 date trigger 直接吃派生时刻，秒级自然生效，无需权限/通道变更。

### D5. 派生的响应式订阅口径

- 读取点按需二选一：组件里 `useStore(selectPlanned(i))` 单点订阅；纯函数/调度器里直接调 `projectPlanned(cycle, interval)`。
- 不做全量 memo 缓存——`count ≤ 12`，每次 O(n) 现算成本可忽略（12 次乘加）。

### D6. 常量归结：只搬"跨模块复用且无单一归属"的，设明确不搬清单

扫描结果（事实基础）：
- `HOUR_MS` 在 `cycle.ts:10` 与 `specialmed.ts:13` **重复定义**；`DAY_MS` 仅 cycle.ts 有，但 `med.ts:20`、`med-form.tsx:169,355`、`response.ts:118,124`、`format.ts:50`、`useStore.ts:183` 硬写 `86_400_000`；`60_000` 裸写散布 8+ 处。
- 30 分钟补登确认阈值重复 2 处（`dose.tsx:61`、`useHomeActions.ts:67`）；60 秒到点判定重复 4 处（`dose.tsx:149`、`Hero.tsx:196`、`HomeCards.tsx:62`、`SpecialCard.tsx:46`）。
- `scheduler.ts:256,274` 硬编码 `'#7C3AED'`/`'#B45309'`，未走 `COLORS` token。

结构：

```
src/constants/
├── time.ts        // MINUTE_MS / HOUR_MS / DAY_MS
└── thresholds.ts  // BACKFILL_CONFIRM_AFTER_MS(30min) / DUE_GRACE_MS(60s)
```

- **搬**：时间毫秒常量、两个业务阈值、scheduler 的 identifier 前缀（随 D3 的 scheduler 改造顺手语义化）。
- **不搬**（写进 design 以防实施时过度归置）：`DOSE_*` / `MAX_DOSES` / `SPECIAL_MODE_*` 留 `types.ts`（与类型一体）；`COLORS` / `MED_COLORS` 留 `colors.ts`（tailwind 真源镜像，职责已清晰）；`CHANNEL_ID` / `CATEGORY_*` / `ACTION_*` 留 `notifications/channel.ts`（模块内聚，跨模块使用均 import 该模块）。
- 备选：全量搬到一个 `constants/index.ts` 桶文件 —— 拒绝，按域分文件（time/thresholds）避免桶文件变成垃圾抽屉；也不建 index.ts 转出口，直接 import 具体文件。

### D7. utils 归档：准入四条 + 分层红线

```
src/utils/
├── number.ts      // pad2
├── datetime.ts    // startOfDay / startOfToday
├── id.ts          // genId(prefix?)：`${Date.now()}-${random36}`
└── timestamp.ts   // clampAt(at, now)（并入或指向 lib 内的统一钳制）
```

- **准入标准**（写进 spec 的验收线）：静态、类型注解清晰、返回值确定、与业务松耦合、多处使用。五条全占才进 `utils/`，只占部分的留在 `lib/`。
- **注释规范（用户明确要求）**：constants 的常量、utils 的函数一律带类型注解；utils 函数带 JSDoc（陈述原始语义，覆盖参数/返回值）。注释只写"它是什么/做什么"，不写与含义无关的解读（不写出处考据、不写使用建议、不写实现思路）——这条与项目既有风格一致（`types.ts` / `cycle.ts` 的现有注释就是此风格），实施时以此为基准线。
- `pad2`：三处独立实现（`format.ts`、`scheduler.ts`、`special-form.tsx`）+ `useHomeActions.ts` 两处手写 `padStart`——全部收敛到 `utils/number.ts`，`format.ts` 内部改 import（对外签名不变，legacy 文案对齐不受影响）。
- `startOfDay`：`format.ts:42` 与 `repair.ts:26`（`startOfToday`）语义重叠——归 `utils/datetime.ts`，两者改 import。
- **分层红线**：`utils/` 禁止 import `lib/` 与 `store/`，方向只能是 lib/store/app → utils。tsconfig 层面暂不加约束（项目未用 eslint 边界插件），靠 code review + tasks 验收项保证；如后续引入依赖检查再工具化。
- 备选：把 `cycle.ts` 的 `HOUR_MS` 等直接 re-export 当 utils —— 拒绝，常量归 constants、函数归 utils，两目录职责不混。

### D8. 与 D1/D3 的实施耦合

- 常量与 utils 的归结**先于** planned 派生改造落地（tasks 编排 1→2 顺序），使派生内核、store action、scheduler 的重写直接 import 新常量/工具，避免先写一遍裸数字再改一遍。
- `lib/timestamp.ts`（D3 草案）与 `utils/timestamp.ts` 合并为一处：`clampAt` 是纯函数且多处使用，按 D7 标准归 `utils/`；`lib/effective.ts` 保留在 lib（有"推迟优先"业务语义，不算松耦合）。

## Risks / Trade-offs

- [派生结果与旧持久化值历史不一致，切换后计划时刻跳变] → 行为等价于既有 `repairState` 的重投影意图，`repair.test.ts` 已覆盖该路径；切换瞬间用户重新打开 app 即完成收敛。
- [保留 `planned` 空字段造成"看似持久化实则没写"的困惑] → 类型注释 + tasks 里明确"兼容期"边界；后续可开一个小 change 删字段。
- [`time-picker` 控件分钟粒度 vs 秒级内部精度，用户可感知"秒位不可控"] → 控件精度不属本次范围；spec 已限定"补登入口以秒为准"仅约束内部不取整。
- [`skip()` 不重排的 legacy 行为依赖 planned 数组快照] → 派生模型下 skip 天然不影响 planned（跳过不写锚点），行为保持一致；`cycle.test.ts` 补一条用例钉住。

## Migration Plan

1. 引入 `projectPlanned`/`plannedAt`/selector，消费方分批切换（每批跑 `yarn typecheck && yarn test`）。
2. `partialize` 停写 `planned`、`repairState` 停读；旧数据自然兼容（读侧忽略）。
3. 删 `roundToMinute`、接秒级精度；文案层守门不变。
4. 回滚策略：单 change 原子切换，回滚 = revert；无数据迁移故无回滚数据问题。

## Open Questions

（无——`planned` 兼容期保留、time-picker 控件精度边界两处已在 D1/D4 给出倾向性决定，不阻塞实现。）
