# Design

## Context

现行架构（v2）：全局唯一 `Cycle`（今日轮次）承载所有人的服药节奏——`interval`（1–12h）+ `doseCount`（1–12 次）+ `firstAt` 构成一条全局链，`projectPlanned` 以「最近实际服用 + 间隔」链式派生计划时刻；`Med` 只有 `slotMask`（属于第几次），没有自己的时间；特殊用药单点 `nextAt`。详见 `openspec/specs/cycle-scheduling/spec.md` 与 `src/lib/cycle.ts`。

本变更将其替换为「每药一个计划」的模型。数据不迁移（用户已确认）：加载旧结构时按空数据重置，用户重新配置。

## Goals / Non-Goals

**Goals**

- 每药独立计划模型 + 领域纯函数，可单测。
- 首页重构为今日时间线，多药聚合。
- 特殊用药收敛为三形态并升级为记录列表。
- 通知调度改为每药每槽位 + 滚动预排窗口。

**Non-Goals**

- 数据迁移与 legacy 兼容（明确放弃）。
- weekly 型「每天不同时刻」（v2 再议，spec 已限定 v1 为「选中星期几 + 统一时刻组」）。
- 饭前/饭后作为偏移引擎（标签只进文案；「饭前 -30 分钟」只在**应用默认模板那一刻**一次性折算成钟表时刻）。
- 跨设备同步、云端备份。

## Decisions

### D1. 计划内嵌于 Med，模板单独成集合（不建独立 Plan 实体表）

```ts
// src/lib/types.ts（新增/变更部分，示意）
type PlanType = 'daily' | 'weekly' | 'interval';

type PlanSlot = {
  hour: number; minute: number;
  label?: string;        // 早/中/晚/饭前/饭后/睡前…
  dose?: string;         // 槽位级用量，缺省回退 med.dose
};

type SchedulePlan = {
  type: PlanType;
  slots: PlanSlot[];          // daily/weekly 用；interval 不用（次数在 med 上）
  daysMask?: number;          // weekly：bit0=周一 … bit6=周日
  intervalHours?: number;     // interval 用，1–72
  dosesPerDay?: number;       // interval 用，1–12（沿用 MAX_DOSES 语义）
};

type Med = {
  // …现有字段，除 allDoses / slotMask 全部保留
  plan: SchedulePlan;
};

type SpecialMode = 'interval' | 'daily' | 'once' | 'weekly-count' | 'dates';
type SpecialModeValue = ... // once: 当日时刻数组；weekly-count: 目标次数+推进节奏；dates: 日期数组
```

- 计划是「药的属性」而非可共享实体 → 内联存储，删除药即删除计划，无悬空引用。
- 模板存 `store.templates: SavedPlan[]`（复制语义），应用时深拷贝进药。**不选引用语义**：用户单独微调某药是常态，引用同步会让「改模板影响谁」变成心智负担。
- 备选（否决）：独立 `plans` 集合 + med.planId。多一层间接，收益只在「改模板联动全部药」，与复制语义决策冲突。

### D2. 剂量记录以 `(medId, slotKey, dateKey)` 寻址，集中存储

```ts
type DoseRecord = {
  medId: string;
  slotKey: string;       // daily/weekly: "0".."N-1"（槽位序号）；interval: 同左（当天第几次）
  dateKey: string;       // YYYY-MM-DD
  status: DoseStatus;    // PENDING/TAKEN/SKIPPED（漏服为派生，不落盘）
  actedAt: number;       // 秒级精度，0 = 未记录
  snoozeUntil: number;
};

type AppState = {
  meds: Med[];
  records: DoseRecord[];   // 替代 cycle
  specials: SpecialMed[];
  templates: SavedPlan[];
  // interval / doseCount / cycle 移除
};
```

- 集中列表而非 `med.records` 嵌套：一次遍历即可做当日聚合与过期清理；对 zustand 不可变更新也更直接。
- `slotKey` 用字符串序号而非时间串：interval 型计划时刻随锚点滚动，「第几次」是稳定身份，「几点」不是。
- 保留全局 `DoseStatus` / `DOSE_*` 常量与 `snooze` 语义（推迟目标优先，`effective.ts` 不变）。

### D3. 派生入口唯一：`plan.ts` 的 `projectDay(med, records, dateKey)`

- daily/weekly：`slots` 直接映射时刻；weekly 用 `daysMask` 判断当天是否在计划内。
- interval：每药粒度继承 `projectPlanned` 的锚点链逻辑——`src/lib/cycle.ts` 的核心算法**平移**进 `plan.ts`，锚点取「该药该日（含跨天滚动）最近一次 `actedAt`」，`cycle.test.ts` 三个 legacy 案例以新函数名继续钉住。
- 漏服：`status === PENDING && due < now - GRACE` 时 UI 呈现「已漏服」；纯派生，不写入记录。**不选持久化漏服**：凌晨跨天、时区、补登撤销都会让持久化状态变脏，派生是唯一自洽解。
- 「已漏服」与「已跳过」在 `format.ts` / UI 层用不同文案与样式区分（如「已漏服」琥珀色 vs「已跳过」灰色）。

### D4. 今日时间线聚合：`aggregateDay(meds, records, dateKey)`

```
TimelineEntry = { med, record, due: 到点时间, planSlot, status: 含漏服派生 }
```

- 按每药 `projectDay` 输出后展平、按 `due` 升序排序。同一时刻多药按药名次序稳定排序。
- 顶部进度 = `TAKEN 计数 / 当日总剂量`；`aggregateDay` 返回该统计，页面零重复计算。
- interval 型跨天滚动（如 22:00 服用推到次日 04:00）：归属「计划时刻所在日」，次日时间线显示它。

### D5. 通知：每药每槽位一条，滚动预排 48h

- identifier：`dose-<medId>-<slotKey>-<dateKey>` / `special-<id>-<recordKey>`；派生函数单一来源（shared-foundation delta 已约束配对）。
- **预排窗口 48 小时**（用户确认 24–48h 取 48）：daily/weekly 直接按 slots 排未来 48h 内的剂量；interval 型只排「下一个」待服剂量（锚点未知的后续剂量无从派生，锚点出现后由重排覆盖）。
- 重排时机 = 现有触点全保留：应用启动 / `markTakenAt` / `skip` / `snooze` / 计划保存 / 开关提醒。`syncAll(input)` 签名不变，`SchedulerInput` 内部从 `cycle` 换成 `meds + records`。
- 备选（否决）：Android 周期性 trigger（`TYPE_DAILY`）——无法表达 weekly 与「提醒内容按槽位变化」，且expo-notifications 的周期触发在本应用「精确闹钟 + 链式重排」的精度要求下不可控。
- 精确闹钟权限与渠道复用现有 `channel.ts` / `perms.ts`，不变。

### D6. 特殊用药：三种形态 + 记录列表

```ts
type SpecialMode = 'once' | 'weekly-count' | 'dates';

type SpecialMed = {
  mode: SpecialMode;
  onceDate?: string;          // once：单个日期
  times: string[];            // once / dates：HH:mm 列表
  dates: string[];            // dates：单选或多选日期
  weeklyTarget?: number;      // weekly-count：每周目标次数
  weeklyStepDays?: number;    // weekly-count：每 N 天推进
  records: SpecialRecord[];   // { key, due, status, actedAt, snoozeUntil }
  nextAt: number;             // 最近一条未处理剂量的到点时间
};
```

- 形态收敛为三种：`once`（单日期 + 多时刻）、`weekly-count`（目标次数 + 固定间隔推进，周一 00:00 归零）、`dates`（多日期 + 共用时刻列表）。`interval` / `daily` 不再属于特殊用药。
- `once` / `dates` 在配置时即展开为完整记录列表（剂量数有限）；`weekly-count` 记录后按固定间隔天数推下一剂。
- `code`（通知按钮回传 0–127 编码）保留。

### D7. 页面层改造范围

| 页面 | 改动 |
|------|------|
| `med-form.tsx` | + 计划编辑器（类型下拉、模板动作、槽位列表编辑时刻/数量/单位/标签）；- slotMask 区块；疗程改数值输入、复诊改下拉 |
| `settings.tsx` | - 次数/间隔两项；保留提醒开关、通知测试、导出等 |
| `(tabs)/index.tsx` + `Hero.tsx` + `HomeCards.tsx` | 重构为时间线：顶部聚合进度条 + 剂量列表；Hero 三态退场，空态「无计划」引导去药物页 |
| `time-picker.tsx` | - `first` 模式；backfill 改为 `(medId, slotKey, dateKey)` 参数 |
| `dose.tsx` | 寻址从全局 index 改为 med+slot |
| `(tabs)/special.tsx`、`special-form.tsx` | 三形态下拉 + 形态配置（日期/时刻列表、目标次数与间隔）+ 记录列表 |

计划编辑器组件放 `src/components/plan/`（`src/app/` 下不放非路由代码，架构硬规则）。

### D8. 表单控件映射（KISS）

按字段取值性质统一选型，避免同页混用：

| 字段 | 控件 | RN / Expo 组件 |
|------|------|----------------|
| 计量单位 | 下拉（默认「片」；含喷/揿/吸/涂/滴/泵等给药途径单位） | `Picker` + `Picker.Item`（`@react-native-picker/picker`） |
| 剂型、服用方式 | 下拉 | 同上 |
| 复诊提醒 | 下拉（不提醒 / 第1天 / 第3天 / 第5天 / 1-4 周） | 同上 |
| 计划类型、服用时机标签、特殊用药形态 | 下拉 | 同上（Android `mode="dropdown"`） |
| 数量（用量、疗程天数、间隔、次数、目标次数） | 文本输入（支持小数与「半」等数字文本） | `TextInput`（默认键盘，禁用 numeric-only） |
| 时刻 | 时间选择器 | `DateTimePicker mode="time"`（`@react-native-community/datetimepicker`，已安装 9.1.0） |
| 星期 | 星期多选选择器 | 自定义 `WeekdayPicker`（`Pressable` 多选，无第三方依赖） |
| 日期 | 日期选择器 | `DateTimePicker mode="date"` |
| 名称、备注、类型不明的字段 | 文本输入 | `TextInput`（备注 `multiline`） |

- `@react-native-picker/picker` 为本次唯一新增依赖，Expo SDK 57 推荐 2.11.4，用 `npx expo install` 安装；MUST NOT 引入 `react-native-picker-select` / `react-native-dropdown-picker`。
- 模板应用是动作而非取值，使用 `Pressable`，不占用下拉。
- 不写解释性小字；只有「下次 = 上次实际服用 + 间隔」这类无法由标签自明的规则保留一句。

### D9. 存储版本与重置

`persist` `version: 1 → 3`，`migrate` 对 v≤2 一律返回 `initialState`（等价清空重置）。`repair.ts` 的自愈规则同步改写（records 与 meds 对齐：medId 不存在即丢弃）。AGENTS.md「字段名与 legacy JSON 对齐」不变量删除；README 差异表加 v3 说明。

## Risks / Trade-offs

- **[旧用户数据丢失]** → 启动时一次性 `Alert` 告知「升级后需重新配置药物」，并给出「设置页清空全部数据」入口兜底；存储 key 不变，无残留脏数据。
- **[interval 型跨天滚动与 daily 聚合边界混淆]** → `projectDay` 内先按「计划时刻归属日」过滤再排序，单测覆盖 23:00+8h→次日 07:00 案例。
- **[48h 预排被系统省电策略截断（厂商杀后台）]** → 启动重排兜底 + 保留现有「exact alarm 权限引导」；窗口缩短到 24h 不解决此问题，故不再缩。
- **[weekly-count 推进语义与用户直觉偏差]** → v1 取最保守实现（固定间隔 + 周一重置），记录列表直接呈现下一剂日期，不追加解释文案；收集反馈后再迭代。
- **[删除 Hero 后首页信息密度不足（如连续使用天数 streak）]** → streak 逻辑保留在 store（`touchDailyUse`），时间线头部小字呈现，不单独立卡。

## Migration Plan

单机 Android 应用，无服务端。发布顺序：v3 构建直接覆盖安装；首次启动检测 `version ≤ 2` → 重置 → 告知弹窗。回滚 = 重装旧版（数据已在重置时丢失，README 明示）。

## Open Questions

- 设置页删除次数/间隔后是否新增「默认标签集」（用户常用饭前/饭后/睡前标签管理）——不影响 specs 与任务拆分，实现期决定。
- `templates` 是否需要删除/排序管理界面——v1 在计划编辑器内提供「保存为模板」，模板管理列表可后补。
