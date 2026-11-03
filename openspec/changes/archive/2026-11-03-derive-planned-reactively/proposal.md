# Proposal

## Why

`Cycle.planned[]` 目前既被持久化又被多处手写重算（`projectPendingFromLastTaken` / `rescheduleAfterTaken` / `startCycle` / `repair` 各维护一份投影逻辑），持久化值与规则之间存在"两份真相"的漂移风险。同时，"推迟感知的到点时间"在普通药（`effectiveTime`）与特殊用药（`effectiveAt`）两处语义相同却各自实现，`markTakenAt` / `markSpecialTaken` / `snooze` / `snoozeSpecial` 等 action 对时间戳的取整与钳制规则也散落在各调用方。统一为派生计算 + 公共封装可消除重复、降低维护成本，并为秒级计时精度铺路。

## What Changes

- **`planned[]` 不再持久化，改为响应式派生**
  - `Cycle` 的计划时刻由 `firstAt` + `interval` + `actedAt[]`/`status[]`（链式锚定规则：下次 = 最近实际服用 + 间隔）在读取时统一推导，提供 store selector 供消费方订阅。
  - 持久化层（zustand `partialize`）不再写出 `planned`；反序列化（`merge` / `repairState`）对旧数据中的 `planned` 字段**忽略并重算**，旧存量数据无需迁移。
  - 链式规则不变：`next = 最近一次实际服用时间 + interval`，`cycle.test.ts` 的三个 legacy 示例继续钉住该行为。
- **同语义功能统一为公共方法（TypeScript 封装）**
  - 合并 `cycle.ts:effectiveTime(cycle, i)` 与 `specialmed.ts:effectiveAt(m)` 的"推迟优先"语义为统一的时间工具层（单文件导出，两域各自保留薄适配或直接换用统一函数）。
  - 统一 `markTakenAt` / `markSpecialTaken` / `snooze` / `snoozeSpecial` 中重复的"当前时间 or 补登时间"钳制逻辑（`Math.min(atMillis, now)`）为公共函数。
  - 统一 `scheduler.ts`、`dose.tsx`、`useHomeActions.ts`、`time-picker.tsx` 中重复的分钟格式化 fallback（`pad2` / 手写 `padStart`）为共享工具。
- **公共常量语义化归结到 `src/constants/` 统一维护**
  - 时间毫秒常量（`HOUR_MS` / `DAY_MS` / `MINUTE_MS`）去重后归结（现 `HOUR_MS` 在 cycle.ts 与 specialmed.ts 重复定义，`86_400_000` 等裸写散布于 med.ts、med-form.tsx、response.ts、format.ts、useStore.ts）。
  - 业务阈值常量语义化命名：30 分钟补登确认阈值（`dose.tsx` / `useHomeActions.ts` 重复）、60 秒到点判定窗口（`dose.tsx` / `Hero.tsx` / `HomeCards.tsx` / `SpecialCard.tsx` 重复）。
  - 通知相关常量（identifier 前缀、硬编码色 `#7C3AED` / `#B45309`）归结，颜色改走 `COLORS` token 镜像。
  - **边界**：类型层常量（`DOSE_*`、`MAX_DOSES`、`SPECIAL_MODE_*`）留在 `types.ts`（与类型定义一体）；`COLORS` / `MED_COLORS` 留在 `colors.ts`（tailwind 真源镜像）；通知 channel/category 字符串留在 `notifications/channel.ts`（模块内聚）。移动的只有跨模块复用且无单一归属的常量。
- **可复用工具函数归结到 `src/utils/` 按类归档**
  - 准入标准：静态、类型注解清晰、返回值确定、与业务松耦合、多处使用。
  - 本轮收录：`pad2`（三处独立实现 + 两处手写 padStart）、时刻钳制 `clampAt`、ID 生成（`med-form.tsx` / `special-form.tsx` 重复模板）、`startOfDay`（`format.ts` 与 `repair.ts` 语义重叠）。
  - 与 `src/lib/` 的分工：`lib/` 承载领域逻辑（cycle/med/specialmed 等业务规则），`utils/` 只放无业务语义的通用函数，禁止 utils 反向 import lib。
- **注释与类型注解规范**
  - 归入 `src/constants/` 的常量 MUST 附带清晰注释与类型注解；归入 `src/utils/` 的工具函数 MUST 附带清晰 JSDoc 注释与类型注解（参数、返回值）。
  - 注释内容 MUST 陈述该常量/函数的原始含义与语义；不得添加与其实际含义无关的解读或延伸说明。
- **计时精确度调整到秒级**（**BREAKING**：面向用户的时间呈现与调度基准精度提升）
  - 系统内记录与调度的时间戳不再做分钟取整（`firstAt` 的 `roundToMinute`、补登选择器只到分钟的初始值）；内部一律保留秒级精度（毫秒时间戳，秒粒度，不再 floor 到分钟）。
  - 用户可设置/补登的时间入口（time-picker 的 `mode="time"` 除外）以秒为准；呈现层在"到点倒计时"等需要秒差的场景输出秒级差值。
  - **用户可见文案不变**：`formatTime` 等对 legacy 逐字对齐的 `HH:mm` 输出一律不改，用户默认仍看到 HH:mm；秒级精度只体现在内部计算与新增的倒计时场景。

### 非目标（Non-goals）

- 不改 CRON 等日历式规则表达（已评估不适用，维持事件锚定链模型）。
- 不做数据迁移工具：旧 `planned` 字段被读取方忽略即可，无需转换。
- 不改 `slotMask` / `actedAt` / `snoozeUntil` / `courseDays` 等 legacy JSON key 命名。
- 不改 `SpecialMed` 的调度语义（间隔 / 每天固定）。

## Capabilities

### New Capabilities

- `cycle-scheduling`：普通药周期的时间体系——链式锚定规则（下次 = 最近实际服用 + 间隔）、`planned` 作为派生数据的推导一致性、推迟（snooze）感知的到点时间。
- `time-precision`：系统内时间的记录精度（秒级）——内部时间戳的最小粒度、与分钟取整的兼容行为、呈现层的精度边界。
- `shared-foundation`：公共常量与工具的组织约定——`src/constants/` 与 `src/utils/` 的收录边界、去重后的单一来源、utils 不依赖 lib 的分层约束。

### Modified Capabilities

（无——项目尚无任何已发布 spec，`openspec list --specs` 为空。）

## Impact

- **代码**：
  - `src/lib/types.ts`：`Cycle.planned` 类型收窄/移除（决定派生函数签名）。
  - `src/lib/cycle.ts`：`projectPendingFromLastTaken` / `rescheduleAfterTaken` 收敛为单一纯函数 `projectPlanned(cycle, interval)`，成为唯一派生入口。
  - `src/store/useStore.ts`：action（`startCycle` / `setInterval` / `setDoseCount` / `markTakenAt` / `skip` / `undo` / `snooze`）不再写入 `planned`；`partialize` 移除 `planned` 写出；新增派生 selector。
  - `src/lib/repair.ts`：不再依据持久化 `planned` 修复，改为直接重算。
  - `src/lib/day.ts`、`src/lib/notifications/scheduler.ts`、`src/app/dose.tsx`、`src/lib/useHomeActions.ts`、`src/app/time-picker.tsx`：`planned[i]` 读取点改为派生 selector/函数调用。
  - `src/lib/firstAt.ts`：移除 `roundToMinute`。
  - `src/constants/`（新）：`time.ts`（`MINUTE_MS` / `HOUR_MS` / `DAY_MS` 去重）、`thresholds.ts`（补登确认、到点判定阈值）。
  - `src/utils/`（新）：`pad2` / 时刻钳制 `clampAt` / ID 生成 / `startOfDay` 等通用工具，按类归档。
  - `src/lib/med.ts`、`src/app/med-form.tsx`、`src/lib/notifications/response.ts`、`src/components/home/Hero.tsx`、`src/components/home/HomeCards.tsx`、`src/components/special/SpecialCard.tsx`：硬编码毫秒数、阈值、`padStart` 换用 constants/utils。
  - `src/lib/notifications/scheduler.ts`：`pad2` 去重、identifier 前缀语义化、硬编码色改走 `COLORS` token。
  - `src/app/med-form.tsx`、`src/app/special-form.tsx`：重复的 ID 生成模板换用共享工具。
- **测试**：`src/lib/__tests__/cycle.test.ts`（legacy 三示例必须继续通过）、`repair.test.ts` 需按派生模型调整；新增派生一致性与秒级精度用例。
- **数据**：AsyncStorage `medtimer_data` 中旧 cycle 的 `planned` 字段将被忽略；`firstAt` / `actedAt` / `snoozeUntil` / `interval` 语义与命名不变，无破坏性迁移。
- **通知**：`scheduler.ts` 消费派生后的 `planned`，一次性 date trigger 的排定时刻从分钟粒度变为秒粒度（更准，无需权限变化）。
- **风险**：派生与旧持久化投影存在历史不一致时（用户改过间隔/补登过），切换后以派生规则为准，行为可能与旧显示差几小时——`repair.test.ts` 覆盖该场景。
