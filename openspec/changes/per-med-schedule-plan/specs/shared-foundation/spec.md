# Spec Delta

## MODIFIED Requirements

### Requirement: 通知常量单一来源

通知 identifier 前缀与通知色 SHALL 有单一定义来源；通知色 MUST 引用颜色 token 镜像（`COLORS`），不得硬编码十六进制字面量。identifier SHALL 覆盖「每药每槽位」的剂量维度（常规计划）与「每药每记录」的剂量维度（特殊用药），同一剂量的排定与取消 MUST 通过同一 identifier 派生函数配对成功。

#### Scenario: 通知色走 token

- **WHEN** 排定特殊用药或复诊提醒并指定通知色
- **THEN** 颜色值来自 `COLORS` token（violet/amber），与主题真源一致

#### Scenario: 前缀改名零散布

- **WHEN** 修改某个通知 identifier 前缀
- **THEN** 只需修改单一常量定义点，排定与取消仍配对成功

#### Scenario: 剂量维度 identifier 唯一

- **WHEN** 系统为药物 A 的今天 08:00 槽位排定提醒，稍后取消该剂量
- **THEN** 两者生成相同 identifier（含药物标识与槽位/日期维度），取消精确命中该条，不影响其他药物或其他槽位的排定

## ADDED Requirements

### Requirement: 常量归置覆盖计划维度

常规计划的槽位上限、星期掩码位定义、默认模板基准时刻（如 08:00 / 12:00 / 18:00）、饭前偏移分钟数 SHALL 以语义化常量归结到 `src/constants/`，每个常量 MUST 只有一个定义点。

#### Scenario: 默认模板时刻单一来源

- **WHEN** 计划编辑器生成「每日三次饭后」的默认时刻
- **THEN** 基准时刻读取自 `src/constants/` 的语义常量，不在 UI 代码中裸写字面量

#### Scenario: 饭前偏移常量

- **WHEN** 生成「饭前」组合的计划时刻
- **THEN** 偏移分钟数来自语义常量，调整偏移只需改一处
