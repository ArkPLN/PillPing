# Tasks

## 1. 领域模型与纯函数（Change A 地基）

- [x] 1.1 在 `src/lib/types.ts` 定义 `PlanType` / `PlanSlot` / `SchedulePlan` / `DoseRecord` / `SavedPlan`，扩展 `SpecialMode` 为三种形态与对应配置类型，`Med` 增加 `plan` 并移除 `allDoses` / `slotMask`；`yarn typecheck` 通过（预期下游报错在后续任务消除）
- [x] 1.2 新建 `src/lib/plan.ts`：`projectDay(med, records, dateKey)` 实现 daily/weekly 直读与 interval 链式派生（锚点 = 该药最近 `actedAt`，跳过不写锚点），并输出漏服派生标志；单测覆盖：每日固定、weekly 掩码、interval 三个 legacy 链式案例（8:00/13:00/18:00、10:00 后重排 16:00/22:00/次日04:00、跳过不重排）、跨天滚动归属
- [x] 1.3 新建 `src/lib/timeline.ts`：`aggregateDay(meds, records, dateKey)` 展平排序（due 升序、同刻按药名稳定序）并统计已服/总数；单测覆盖多药混合、漏服呈现、进度求和
- [x] 1.4 重写 `src/lib/med.ts`：以 `plan` 槽位替代 `slotMask` 位操作，保留疗程 / 复诊函数；单测验证 `forSlot` 语义迁移（plan 槽位命中）与疗程内过滤
- [x] 1.5 新建 `src/lib/plan-template.ts`：内置「每日一次/两次/三次」基准时刻与「饭前 -30 分钟」组合逻辑（时刻常量取自 `src/constants/`），模板深拷贝应用；单测覆盖饭后 08:00/12:00/18:00、饭前 07:30/11:30/17:30、复制语义（改模板不影响已应用药物）
- [x] 1.6 扩展 `src/lib/specialmed.ts`：仅三种形态（once 单日期多时刻 / weekly-count 目标次数+固定间隔推进+周一归零 / dates 多日期+共用时刻），移除 interval 与 daily 分支；单测覆盖 once 多时刻、weekly-count 达标后本周静默、dates 单选与多选、补登重算
- [x] 1.7 新增 `src/lib/units.ts`：计量单位集合（片/粒/颗/丸/袋/包/枚/板/盒/贴/喷/揿/吸/涂/滴/泵/支/瓶/杯/勺/mL/mg/g/μg/单位/IU，默认「片」），供药物与特殊用药共用；单测验证默认值与集合完整

## 2. 状态层与存储

- [x] 2.1 重写 `src/store/useStore.ts`：移除 `interval` / `doseCount` / `cycle` 及其 actions；`records: DoseRecord[]` 新增 `markTaken(medId, slotKey, dateKey, at?)` / `skip` / `undo` / `snooze`（med+slot 粒度）、`saveTemplate` / `applyTemplate`；specials actions 适配记录列表；`yarn typecheck` 通过
- [x] 2.2 持久化版本 1→3：`migrate` 对 v≤2 返回 `initialState`（旧数据清空重置），`repair.ts` 自愈规则改为 records 与 meds 对齐（孤儿记录丢弃）；单测验证旧结构加载后得到空状态
- [x] 2.3 旧用户告知：首次启动检测到重置时弹 `Alert` 说明「需重新配置药物」，并在设置页保留「清空全部数据」入口；手动验证冷启动提示出现

## 3. 通知调度

- [x] 3.1 重写 `src/lib/notifications/input.ts`：`SchedulerInput` 输入源改为 `meds + records + specials`，identifier 派生函数 `doseId(medId, slotKey, dateKey)` / `specialRecordId(id, key)` 单一来源；单测验证同一剂量排定与取消 identifier 配对
- [x] 3.2 重写 `src/lib/notifications/scheduler.ts` `syncAll`：每药每槽位排定，滚动预排 48h 窗口，interval 型只排下一个待服剂量；`syncNextDoseOnly` 改为 med+slot 粒度；单测覆盖 48h 窗口截断、interval 锚点缺失时只排零条
- [x] 3.3 更新 `src/lib/notifications/response.ts`：action 按钮回传 `medId + slotKey + dateKey`（特殊用药为 record key），`code` 编码扩展不越 0–127；用 10 秒后台测试通道手动验证按钮回传后记录成功

## 4. 页面层改造

- [x] 4.1 安装并封装 `SelectField`：使用 `@react-native-picker/picker`（Expo SDK 57 推荐 2.11.4，`npx expo install @react-native-picker/picker`），`Picker` + `Picker.Item`、`selectedValue` / `onValueChange`，Android 使用 `mode="dropdown"`；验证 26 个单位的长度、长列表滚动与深色主题
- [x] 4.2 新建输入组件：`NumericInput`（RN `TextInput`，默认键盘，支持「半」「1.5」，禁止 numeric-only 键盘）与 `WeekdayPicker`（RN `Pressable` 多选，无第三方依赖）；走查两条输入路径
- [x] 4.3 新建 `src/components/plan/PlanEditor.tsx`（计划类型下拉、模板动作、槽位列表：`DateTimePicker mode="time"` + 标签下拉 + 数量文本 + 单位下拉 + 删除；按周用 `WeekdayPicker`；按间隔用数值文本）并在 `med-form.tsx` 接入，移除 slotMask「服用时机」区块；用量拆为数量文本 + 单位下拉，疗程改数值输入（默认 5、0 不启用），复诊改下拉；手动走查新建/编辑两路径
- [x] 4.4 重构 `(tabs)/index.tsx` + `Hero.tsx` + `HomeCards.tsx` 为今日时间线（顶部聚合进度、剂量条目四态、漏服补登入口、无计划空态引导），移除全局三态 Hero 与「第一次服药时间」开工流程；`yarn test` 通过且手动验证多药混合展示
- [x] 4.5 改造 `settings.tsx`：删除「每天服药次数」「服药间隔」两项，保留提醒开关 / 通知测试 / 清空数据；手动验证无残留全局配置入口
- [x] 4.6 改造 `time-picker.tsx`（移除 `first` 模式，backfill 参数改 `(medId, slotKey, dateKey)`）与 `dose.tsx`（med+slot 寻址，四态操作）；手动验证补登与撤销后通知重排
- [x] 4.7 改造 `special-form.tsx` 与 `(tabs)/special.tsx`：形态下拉（一次性 / 每周 N 次 / 指定日期）、形态配置（`DateTimePicker mode="date"`、时刻列表、数值输入）、记录列表；手动验证三种形态各建一条并收到提醒
- [x] 4.8 按 `form-controls` 规范逐页核查：枚举全部 `Picker`、数值全部 `TextInput`（支持小数与中文数字）、时间/日期 `DateTimePicker`、星期 `WeekdayPicker`、无解释性小字；走查药物表单与特殊用药表单各一遍

## 5. 测试收口与文档

- [x] 5.1 迁移 `src/lib/__tests__/cycle.test.ts` 到 interval 型新函数（三个 legacy 案例继续钉住），删除全局周期相关断言；`yarn test` 全绿
- [x] 5.2 新增 `plan.test.ts` / `timeline.test.ts` / `plan-template.test.ts`（若 1.2/1.3/1.5 已建则合并此步为补漏），漏服派生与跳过区分有断言；`yarn test` 全绿
- [x] 5.3 更新 `README.md`（v3 功能描述与 legacy 差异表、数据不迁移说明）与 `AGENTS.md`（删除「字段名与 legacy JSON 对齐」不变量，「链式排程」改为每药 interval 语义表述）
- [x] 5.4 全量验收：`yarn typecheck` + `yarn test` 通过，`npx expo-doctor` 无新增问题；Android 开发构建跑通「添加两药不同计划 → 首页时间线 → 记录/跳过/漏服 → 通知按槽位触发」与「特殊用药三种形态各一条 → 独立提醒」完整路径
