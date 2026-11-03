# 按时吃药（PillPing)

一个简单，好用的服药提醒应用，基于Expo React Native打造的跨平台APP.

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 框架 | Expo SDK 57 + React Native 0.86 |
| 路由 | Expo Router |
| 语言 | TypeScript + TSX |
| 样式 | NativeWind 4.2.7 + Tailwind CSS 3.4 |
| 状态 | zustand 5 + AsyncStorage  |
| 通知 | expo-notifications |
| 表单 | @react-native-picker/picker + @react-native-community/datetimepicker |
| 图标 | @expo/vector-icons |

## 环境要求

- Node.js 24+ LTS
- Yarn 4
- Android SDK（本地构建 dev client 必须配置）

## 常用开发命令

```bash
# 启用包管理器
corepack enable
# 安装依赖(Expo框架官方推荐)
npx expo install
# 启动开发服务器（Android）
npx expo run:android
# 类型检查
yarn typecheck
# 单元测试（核心排程算法）
yarn test
# Web 预览（仅开发调试，通知能力不可用）
yarn web
```

## 核心规则

### 1. 普通服药：每药独立计划

每种药物拥有自己的服药时间计划，取消全局次数/间隔配置。计划支持三种类型：

- **每天固定时刻**：如每天 08:00、20:00；
- **按周循环**：选定每周哪几天，按同一组时刻提醒；
- **按间隔**：下一次 = 该药最近一次实际服用时间 + 间隔。例如间隔 5 小时：
  - 第 1 次 08:00 服用 → 第 2 次计划 13:00；
  - 第 2 次实际 14:00 才服用 → 第 3 次自动改为 **19:00**；
  - 第 3 次实际 20:30 才服用 → 第 4 次自动改为 **01:30**。

默认模板「每日一次/两次/三次」可与「饭前/饭后」组合：饭后为 08:00 / 12:00 / 18:00，饭前提前 30 分钟；应用后可逐条修改。用量拆分为「数量 + 单位」，数量支持「半」「1.5」等写法。

计划派生与链式规则在 `src/lib/plan.ts`，对应测试在 `src/lib/__tests__/plan.test.ts`。

### 2. 补登

如果已经服过药但忘记登记，可以选择**补登**并填写实际服用时间。补登后会按那个实际时间重新计算下一次。
- 补登只能选择过去的时间。

### 3. 特殊用药

底部「特殊」页用于不按循环日历服用的药，不出现在「今日」时间轴里，也不影响普通服药统计。支持三种形态：

- **一次性（单日内可多次）**：指定一个日期与当日多个时刻；
- **每周 N 次**：设置每周目标次数与提醒间隔，本周达标后静默；
- **指定日期**：单选或多选日期，共用一组时刻。

## 与 legacy 版本的差异

| 项 | 原 Java 版 | 本版本 |
| --- | --- | --- |
| 排程模型 | 全局一条链（次数 + 间隔 + 第一次时刻） | 每药独立计划（每天固定 / 按周循环 / 按间隔） |
| 闹钟模型 | 链式单闹钟（触发后再排下一次） | 每药每槽位一次性通知，未来 48h 预排，启动/状态变更时全量同步 |
| 特殊用药 | 按间隔 / 每天固定 | 一次性 / 每周 N 次 / 指定日期 |
| 数据迁移 | — | v3 结构不兼容旧数据；升级时重置并提示重新配置 |
| 签名钉扎 | 启动校验 APK 证书 SHA-256 | 移除；由 Android v2/v3 签名机制在安装时校验 |
| 厂商自启动 | 跳设置页 | 同样只能跳设置页，无法回读状态 |
| 时区变更重排 | BootReceiver 监听 TIME_SET | 应用回到前台时兜底重同步 |
| 应用体积 | ~117 KB | 预计 8–15 MB（RN 运行时开销） |

## 后台提醒

应用使用 `expo-notifications` 的本地通知与精确闹钟（`SCHEDULE_EXACT_ALARM`），不依赖推送服务、不联网。

系统侧仍需用户开启：

1. **通知权限**：设置 → 应用 → 按时吃药 → 通知 → 允许通知
2. **精确提醒**：设置 → 应用 → 特殊应用权限 → 闹钟和提醒 → 允许
3. **后台运行**：设置 → 电池 → 后台耗电管理 → 按时吃药 → 允许后台运行

国产手机（vivo / OPPO / 小米）建议额外允许「自启动」「后台高耗电」「锁屏显示」。应用内「开始指南」会逐项检查并提供跳转。

### 后台测试

设置 → **后台测试提醒**：

1. 点「测试」；
2. 按 Home 退出应用（或锁屏）；
3. 等 10 秒。

如果收到「后台测试提醒 · 成功」，说明后台链路正常。

## 权限说明

| 权限 | 用途 | 不开启的后果 |
| --- | --- | --- |
| `POST_NOTIFICATIONS` | 到点弹出提醒 | 收不到提醒 |
| `SCHEDULE_EXACT_ALARM` | 按分钟准时触发 | 系统可能延迟几分钟 |
| `RECEIVE_BOOT_COMPLETED` | 重启后恢复已排通知 | 重启后可能不再提醒 |
| `VIBRATE` / `WAKE_LOCK` | 振动与唤醒 | 提醒可能无声音 |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | 引导加入电池白名单 | 长时间后台可能漏提醒 |

暂无 `INTERNET` 权限

## 开发说明

- **Web 端仅用于开发预览**：`expo-notifications` 的原生能力在 web 不可用，通知层在 web 上会自动降级为 no-op（见 `src/lib/notifications/platform.ts`），`@react-native-community/datetimepicker` 也不支持 web。
- **路由类型**：启用了 `experiments.typedRoutes`，新增页面后若类型未更新，删除 `.expo/` 重新生成。
- **测试**：`src/lib/__tests__/` 使用 Node 原生 test runner（经 `tsx` 执行），与 RN 运行环境隔离。

## 作者与生成方式

- Demo作者：肚小圆
- 工程化开发与维护：arkpln

## 免责声明

本应用仅用于服药时间提醒，不提供任何关于医学诊断、处方或用药建议。具体药物、剂量、服用方式和时间请遵医嘱，本应用不承担任何连带责任。

## 美术资源

v2.0 使用 `@expo/vector-icons`（Material Icons / Material Community Icons）与本仓库内嵌的胶囊 SVG。原版 Material Symbols 资源与许可见 [`legacy/CREDITS.md`](./legacy/CREDITS.md)。
