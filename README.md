# 按时吃药 · 服药提醒 v2.0.0

一个只在本地运行的服药提醒应用。默认适合「每天 3 次、第一次起床后服用、之后每隔 5 小时一次」，也支持自定义 **1–12 次/天**、自定义间隔，以及独立的**特殊用药**提醒。

v2.0 是原 Java 版（v1.6.2）的 Expo / React Native 重写版：功能、文案与视觉保持一致。

- 原 Java 版完整保留在 [`legacy/`](./legacy) 作为对照参考。
- 新版本仅面向 **Android**。

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 框架 | Expo SDK 57 + React Native 0.86 |
| 路由 | Expo Router（文件式路由） |
| 语言 | TypeScript（strict） |
| 样式 | NativeWind 4.2.7 + Tailwind CSS 3.4 |
| 状态 | zustand 5 + AsyncStorage 持久化 |
| 通知 | expo-notifications（本地通知 + 精确闹钟） |
| 图标 | @expo/vector-icons + 单个内嵌 SVG（胶囊） |

## 环境要求

- Node.js LTS（本仓库在 Node 24 上验证）
- Yarn 4（通过 `corepack enable` 启用）
- Android SDK（本地构建 dev client 时需要）

## 开始使用

```bash
# 启用包管理器
corepack enable

# 安装依赖
yarn install

# 启动开发服务器（Android）
yarn android

# 类型检查
yarn typecheck

# 单元测试（核心排程算法）
yarn test

# Web 预览（仅开发调试，通知能力不可用）
yarn web
```

## 目录结构

```
.
├── legacy/                     # 原 Java 版（对照参考，不参与构建）
├── src/
│   ├── app/                    # Expo Router 路由 = 页面
│   │   ├── _layout.tsx         #   根布局：主题、通知生命周期、首次引导
│   │   ├── (tabs)/             #   底部三 Tab
│   │   │   ├── index.tsx       #     今日
│   │   │   ├── meds.tsx        #     药物
│   │   │   └── special.tsx     #     特殊
│   │   ├── dose.tsx            #   单次服药详情
│   │   ├── med-form.tsx        #   药物表单
│   │   ├── special-form.tsx    #   特殊用药表单
│   │   ├── time-picker.tsx     #   时间选择（首次 / 补登）
│   │   ├── settings.tsx        #   设置
│   │   └── guide.tsx           #   开始指南
│   ├── components/
│   │   ├── ui/                 # 设计系统原语
│   │   ├── home/               # 今日页组件
│   │   ├── meds/               # 药物卡片
│   │   ├── special/            # 特殊用药卡片
│   │   └── forms/              # 表单部件与对话框
│   ├── lib/
│   │   ├── cycle.ts            # 链式排程核心算法
│   │   ├── med.ts              # 药物逻辑
│   │   ├── specialmed.ts       # 特殊用药排程
│   │   ├── format.ts           # 时间格式化
│   │   ├── forms.ts            # 剂型推断
│   │   ├── repair.ts           # 数据自愈
│   │   ├── colors.ts           # 色板运行时出口
│   │   ├── theme.tsx           # 主题（跟随系统 / 浅色 / 深色）
│   │   ├── perms.ts            # 权限与系统设置跳转
│   │   ├── nav.ts              # 安全返回
│   │   ├── notifications/      # 渠道、类目、调度、响应
│   │   └── __tests__/          # 单元测试
│   └── store/useStore.ts       # 全局状态与持久化
├── global.css                  # Tailwind 指令
├── tailwind.config.js          # 语义色板（亮暗成对）
├── metro.config.js             # NativeWind + SVG transformer
└── app.json                    # Expo 配置（包名、权限、通知插件）
```

## 核心规则

### 1. 普通服药：链式排程

下一次服药不是固定按第一次推算，而是：

> **下一次时间 = 最近一次实际服药时间 + 服药间隔**

例如间隔 5 小时：

- 第 1 次 08:00 服用 → 第 2 次计划 13:00；
- 第 2 次实际 14:00 才服用 → 第 3 次自动改为 **19:00**，而不是 18:00；
- 第 3 次实际 20:30 才服用 → 第 4 次自动改为 **01:30**。

这三条规则在 `src/lib/__tests__/cycle.test.ts` 中有对应的单元测试。

### 2. 补登

如果已经服过药但忘记登记，可以选择**补登**并填写实际服用时间。补登后会按那个实际时间重新计算下一次。

- 补登只能选择过去的时间，且不能早于上一次服药时间。

### 3. 特殊用药

底部「特殊」页用于不按普通方案服用的药，不出现在「今日」时间轴里，也不影响普通服药次数。

支持两种模式：

- **按间隔**：每 1–72 小时一次，从最近一次实际服用时间开始计算；
- **每天固定时间**：例如每天 21:00；记录服用后，下一次排到明天同一时刻。

## 与 legacy 版本的差异

| 项 | 原 Java 版 | 本版本 |
| --- | --- | --- |
| 闹钟模型 | 链式单闹钟（触发后再排下一次） | 批量预排所有待服次数（≤12 条），应用启动/状态变更时全量同步 |
| 签名钉扎 | 启动校验 APK 证书 SHA-256 | 移除；由 Android v2/v3 签名机制在安装时校验 |
| 厂商自启动 | 跳设置页 | 同样只能跳设置页，无法回读状态 |
| 时区变更重排 | BootReceiver 监听 TIME_SET | 应用回到前台时兜底重同步 |
| 数据迁移 | — | 不支持从旧版导入（存储结构保持兼容，便于日后扩展） |
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

没有 `INTERNET` 权限，没有动态加载代码。

## 开发说明

- **Web 端仅用于开发预览**：`expo-notifications` 的原生能力在 web 不可用，通知层在 web 上会自动降级为 no-op（见 `src/lib/notifications/platform.ts`），`@react-native-community/datetimepicker` 也不支持 web。
- **路由类型**：启用了 `experiments.typedRoutes`，新增页面后若类型未更新，删除 `.expo/` 重新生成。
- **测试**：`src/lib/__tests__/` 使用 Node 原生 test runner（经 `tsx` 执行），与 RN 运行环境隔离。

## 作者与生成方式

- 作者：肚小圆
- 本应用使用 AI 生成（界面、代码与文案）。

## 免责声明

本应用仅用于服药时间提醒，不提供诊断、处方或用药建议。具体药物、剂量、服用方式和时间请遵医嘱。

## 美术资源

v2.0 使用 `@expo/vector-icons`（Material Icons / Material Community Icons）与本仓库内嵌的胶囊 SVG。原版 Material Symbols 资源与许可见 [`legacy/CREDITS.md`](./legacy/CREDITS.md)。
