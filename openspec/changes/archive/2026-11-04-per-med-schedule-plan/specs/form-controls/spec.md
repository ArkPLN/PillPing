# Spec Delta

## Purpose

定义服药提醒各表单页面的控件选型与文案密度：按字段的取值性质选择下拉、文本、时间/星期/日期专用控件，并在不牺牲语义的前提下保持页面精简。

## ADDED Requirements

### Requirement: 固定枚举字段使用下拉选择

取值集合固定的字段 SHALL 使用下拉选择控件（`select`），SHALL NOT 使用自由文本或单选按钮组。适用于但不限于：计量单位、剂型、服用方式、复诊提醒、计划类型、服用时机标签、特殊用药形态。模板应用等「执行动作」不属于取值字段，可使用按钮。

#### Scenario: 计量单位

- **WHEN** 用户填写每次用量或调整某个时刻的用量
- **THEN** 单位通过下拉选择，默认「片」，可选集合覆盖常见给药途径（片、粒、颗、丸、袋、包、枚、板、盒、贴、喷、揿、吸、涂、滴、泵、支、瓶、杯、勺、mL、mg、g、μg、单位、IU）

#### Scenario: 剂型与服用方式

- **WHEN** 用户选择剂型或服用方式
- **THEN** 均通过下拉选择，不接受自由文本

#### Scenario: 复诊提醒

- **WHEN** 用户设置复诊提醒
- **THEN** 通过下拉选择「不提醒 / 第1天 / 第3天 / 第5天 / 1周 / 2周 / 3周 / 4周」

#### Scenario: 特殊用药形态

- **WHEN** 用户选择特殊用药的形态
- **THEN** 通过下拉选择「一次性 / 每周 N 次 / 指定日期」

### Requirement: 数值字段使用文本输入

明确为数值的字段 SHALL 使用文本输入框，默认支持小数；输入值 SHALL 允许中文数字写法（如「半」「1.5」）。数值字段 MUST NOT 使用下拉选择。若同时提供加减快捷按钮，输入框 SHALL 仍是唯一取值来源。

#### Scenario: 用量数量

- **WHEN** 用户填写每次用量
- **THEN** 数量为文本输入框，可以输入「1」「半」「1.5」

#### Scenario: 连续服用天数

- **WHEN** 用户填写连续服用天数
- **THEN** 使用文本输入框，默认为 5；输入 0 表示不启用该疗程限制

#### Scenario: 间隔与次数

- **WHEN** 用户设置按间隔计划的间隔小时数或每天次数
- **THEN** 均为数值文本输入，接受小数与数字文本

### Requirement: 时间类字段使用专用选择器并区分类型

时间相关字段 MUST 使用对应类型的专用选择器，不得以文本输入替代，且 SHALL 明确区分以下三类：

- 时刻（时:分）：使用时间选择器；
- 星期：使用星期选择器（可多选），不得用文本输入；
- 日期：使用日期选择器，不得用文本输入。

#### Scenario: 时刻

- **WHEN** 用户设置某个服用时刻或一次性用药的当日时刻
- **THEN** 使用时间选择器，选择结果为时:分

#### Scenario: 星期

- **WHEN** 用户设置按周循环的生效日
- **THEN** 使用星期多选选择器，选择结果为星期集合

#### Scenario: 日期

- **WHEN** 用户设置一次性用药的日期或特殊用药的指定日期
- **THEN** 使用日期选择器，选择结果为日历日期

### Requirement: 类型不明确时默认文本输入

字段的取值性质无法明确归入枚举、数值、时刻、星期或日期时，SHALL 默认使用文本输入框。

#### Scenario: 名称与备注

- **WHEN** 用户填写药名、特殊用药名称或备注
- **THEN** 使用文本输入框

### Requirement: 页面文案最小化

表单页面 SHALL 只保留字段标签与必要提示。解释性小字 MUST NOT 出现；仅当语义无法由标签自明时，允许保留不超过一句的说明。页面 SHALL NOT 为凑信息密度增加装饰性说明或重复描述。

#### Scenario: 无冗余说明

- **WHEN** 用户打开药物表单或特殊用药表单
- **THEN** 每个字段只显示标签与控件，不出现解释同一字段用途的辅助段落

#### Scenario: 必要提示最多一句

- **WHEN** 某规则无法由字段标签自明（如按间隔计划的锚点规则）
- **THEN** 允许保留一句最短说明，除此之外不追加文案

### Requirement: React Native 组件映射

本项目为 React Native（Expo SDK 57）应用，表单控件 SHALL 映射到以下真实组件，MUST NOT 使用 Web 语义的 `<select>`、`<input type="time">` 等元素：

- **下拉选择**：`@react-native-picker/picker` 的 `Picker` + `Picker.Item`，使用 `selectedValue` / `onValueChange`；Android SHALL 使用 `mode="dropdown"`。Expo SDK 57 推荐版本为 2.11.4，依赖通过 `npx expo install @react-native-picker/picker` 安装（当前 `package.json` 尚未包含，实现阶段新增）。
- **数值输入**：React Native 核心 `TextInput`，使用默认键盘；MUST NOT 设置 numeric-only 的 `keyboardType`（否则无法输入「半」等中文数字）。解析 SHALL 同时接受小数与中文数字。
- **时刻**：`@react-native-community/datetimepicker` 的 `DateTimePicker`，`mode="time"`、`is24Hour`。项目已安装 9.1.0（与 Expo SDK 57 推荐版本一致），现有 `time-picker.tsx` / `special-form.tsx` 已在使用。
- **日期**：同一 `DateTimePicker`，`mode="date"`，Android 使用系统日期对话框。
- **星期多选**：无原生或官方多选组件，SHALL 以 React Native 核心 `Pressable` 实现自定义 `WeekdayPicker`，MUST NOT 引入第三方多选依赖。
- **名称 / 备注等文本**：React Native 核心 `TextInput`，备注使用 `multiline`。
- **模板与保存等动作**：React Native 核心 `Pressable`（沿用项目 `Pill` / `Button` 封装）。

依赖约束：本变更只新增 `@react-native-picker/picker` 一项；MUST NOT 以 `react-native-picker-select`、`react-native-dropdown-picker` 等替代，除非另行变更规格。

#### Scenario: 下拉映射

- **WHEN** 页面渲染剂型、单位、复诊提醒等固定枚举
- **THEN** 使用 `Picker` + `Picker.Item` 渲染，Android 呈现原生下拉

#### Scenario: 数值输入不被键盘限制

- **WHEN** 用户填写用量数量并输入「半」
- **THEN** `TextInput` 使用默认键盘，能够输入中文数字并成功解析

#### Scenario: 时间与日期分别使用对应模式

- **WHEN** 用户选择时刻或日期
- **THEN** 分别使用 `DateTimePicker mode="time"` 与 `DateTimePicker mode="date"`

#### Scenario: 星期多选无第三方依赖

- **WHEN** 用户选择按周循环的生效日
- **THEN** 使用自定义 `WeekdayPicker`（`Pressable` 多选）实现，不引入第三方多选组件

#### Scenario: 依赖安装方式

- **WHEN** 实现阶段新增下拉依赖
- **THEN** 使用 `npx expo install @react-native-picker/picker` 获得与 SDK 57 匹配的版本，不使用 `yarn add`
