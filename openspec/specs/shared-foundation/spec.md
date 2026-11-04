# shared-foundation Specification

## Purpose

约定公共常量与可复用工具函数的归置：常量以语义化命名归结到 `src/constants/`，与业务松耦合的工具函数按类归档到 `src/utils/`，消除重复定义并明确与 `src/lib/`（领域逻辑）的分层边界。

## Requirements

### Requirement: 公共常量统一归结

跨模块复用的数值/字符串常量 SHALL 以语义化命名定义在 `src/constants/` 下并统一维护，消除重复定义。每个常量 MUST 只有一个定义点。

#### Scenario: 时间毫秒常量去重

- **WHEN** 代码需要"一小时/一天/一分钟的毫秒数"
- **THEN** 从 `src/constants/` 的时间常量模块导入，`src/lib/` 各文件不再重复定义同名常量或裸写毫秒数字

#### Scenario: 业务阈值语义化

- **WHEN** 判定"计划已过半小时可补登"或"到达服药时刻的 60 秒宽限窗口"
- **THEN** 使用 `src/constants/` 下带语义名的阈值常量，而非字面数字表达式

#### Scenario: 类型常量不搬移

- **WHEN** 常量与类型定义一体（服药状态、次数上限、特殊用药模式）
- **THEN** 该常量保留在类型定义文件中，不被移入 `src/constants/`

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

### Requirement: 常量归置覆盖计划维度

常规计划的槽位上限、星期掩码位定义、默认模板基准时刻（如 08:00 / 12:00 / 18:00）、饭前偏移分钟数 SHALL 以语义化常量归结到 `src/constants/`，每个常量 MUST 只有一个定义点。

#### Scenario: 默认模板时刻单一来源

- **WHEN** 计划编辑器生成「每日三次饭后」的默认时刻
- **THEN** 基准时刻读取自 `src/constants/` 的语义常量，不在 UI 代码中裸写字面量

#### Scenario: 饭前偏移常量

- **WHEN** 生成「饭前」组合的计划时刻
- **THEN** 偏移分钟数来自语义常量，调整偏移只需改一处

### Requirement: 可复用工具归档到 utils

静态、类型注解清晰、返回值确定、与业务松耦合且多处使用的函数 SHALL 归档到 `src/utils/` 下，同类函数放同一文件。`src/utils/` MUST NOT 依赖 `src/lib/`（领域层）。

#### Scenario: 数字补零工具收敛

- **WHEN** 多处需要把小时/分钟格式化为两位数字
- **THEN** 使用 `src/utils/` 的单一补零函数，各文件内的私有重复实现移除

#### Scenario: 时刻钳制工具收敛

- **WHEN** 记录补登的服用时刻（不得晚于当前时刻）
- **THEN** 使用统一的钳制函数，普通药与特殊用药的 action 共用同一实现

#### Scenario: ID 生成工具收敛

- **WHEN** 新增药物或特殊用药需要生成唯一 ID
- **THEN** 使用统一的 ID 生成函数，表单页不再重复拼接模板

#### Scenario: 分层约束可验证

- **WHEN** `src/utils/` 下任一文件 import `src/lib/` 或 `src/store/`
- **THEN** 视为违反分层，类型检查应能发现该依赖方向错误

### Requirement: 常量与工具的注释及类型注解

归入 `src/constants/` 的常量 SHALL 附带清晰注释与类型注解；归入 `src/utils/` 的工具函数 SHALL 附带清晰 JSDoc 注释与类型注解（含参数与返回值）。注释内容 MUST 陈述该常量或函数的原始含义与语义，MUST NOT 包含与其原始含义无关的解读或延伸说明。

#### Scenario: 常量注释陈述语义

- **WHEN** 阅读某个归结后的常量定义
- **THEN** 其注释与类型注解陈述该常量本身的含义（如"一小时的毫秒数"），不含与该含义无关的说明

#### Scenario: 工具函数 JSDoc 完整

- **WHEN** 阅读某个归档后的工具函数定义
- **THEN** 其 JSDoc 注释陈述函数的原始语义并覆盖参数与返回值，类型签名完整，不含无关解读

#### Scenario: 注释与实现一致

- **WHEN** 函数或常量的语义发生变化
- **THEN** 其注释同步更新，任何时刻注释陈述的都是当前实现的原始含义
