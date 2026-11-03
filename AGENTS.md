This is an Expo / React Native mobile application (`按时吃药`), migrated from an Android Java app. The original Java implementation lives in `legacy/` and must not be modified — it is the behavioral reference.

Target platform: **Android only**. Windows dev machine, PowerShell 7 shell.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

Appending `.md` to any Expo docs URL returns a version that preserves fenced code blocks (e.g. `https://docs.expo.dev/guides/tailwind.md`).

## Commands

This project uses **Yarn 4** (via corepack). Do not use npm/pnpm/bun.

```bash
corepack enable             # activate Yarn 4 once
yarn install                # install dependencies
yarn android                # start dev server targeting Android
yarn web                    # web preview (dev only; notifications unavailable)
yarn typecheck              # tsc --noEmit
yarn test                   # unit tests (node test runner via tsx)
npx expo install <package>  # ALWAYS use instead of yarn add for Expo/native packages
npx expo-doctor             # diagnose dependency and config issues
```

Run `yarn typecheck` and `yarn test` before declaring any task done.

## Architecture

- **Routing**: Expo Router, file-based. Every file under `src/app/` is a route. `_layout.tsx` defines navigators. Non-route code (components, hooks, utils) MUST live outside `src/app/` — anything in there becomes a route (this bit us: a hook file inside `app/` was picked up as a route).
- **Styling**: NativeWind 4.2.7 + Tailwind 3.4. Use `className`. Tailwind v4 is NOT compatible with NativeWind 4.
- **Color tokens**: single source of truth is `tailwind.config.js`. Dark variants are paired with a `-d` suffix (`text-ink` / `text-ink-d`). For non-className contexts (notification channel color, SVG fill, StatusBar), use `src/lib/colors.ts`.
- **State**: zustand in `src/store/useStore.ts`, persisted to AsyncStorage under key `medtimer_data`. Domain logic is pure functions in `src/lib/` so it can be unit tested without React.
- **Notifications**: `src/lib/notifications/`. Channels/categories, `syncAll()` re-schedules everything, `response.ts` handles action-button taps.

## Hard rules

- **Never edit `legacy/`**. It is the reference implementation.
- **Preserve all user-facing Chinese copy verbatim.** Check against `legacy/src/com/dsh/medtimer/` when touching text.
- **Notification APIs must be platform-guarded.** `expo-notifications` throws on web. Use `safeNotify()` / `NOTIFICATIONS_SUPPORTED` from `src/lib/notifications/platform.ts`.
- **Never call `router.back()` directly.** Use `goBack()` from `src/lib/nav.ts` — it falls back to the home route when there is no history stack (deep links, direct URL access).
- If `ios/` and `android/` directories do not exist, they are generated (CNG). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go bundles only its own native modules. This app uses exact-alarm notifications, so **a development build is required**: `npx expo run:android`, or `eas build --profile development`.
- Do not add a library without checking that it works on Android and that an Expo-recommended module doesn't already cover it.

## Data model invariants（v3）

每药独立计划，旧版「字段名与 legacy JSON 对齐」约束已废止：

- `Med.plan` 是唯一计划来源，支持 `daily` / `weekly` / `interval` 三种类型；槽位用稳定 `id`，剂量记录身份为 `(medId, slotKey, dateKey)`。
- `DoseRecord` 持久化每次剂量的状态、实际时刻、推迟目标与计划时刻；计划时刻本身仍由 `src/lib/plan.ts` 派生，不作为独立真相持久化。
- 全局 `Cycle`、`interval`、`doseCount`、`slotMask` 已移除；存储版本为 3，旧数据不迁移（加载时重置并提示）。

链式规则仅适用于 **interval 型计划**，且按药隔离：

> 该药下一次 = 该药最近一次**实际**服用时间 + 间隔

`src/lib/__tests__/plan.test.ts` 用三个 legacy 示例钉住该行为。修改 `src/lib/plan.ts` 的 interval 分支时必须同步更新这些测试。

## 表单控件（KISS）

- 固定枚举用 `@react-native-picker/picker` 的下拉；数值用默认键盘的 `TextInput`（支持「半」「1.5」）；时刻/日期用 `@react-native-community/datetimepicker`；星期用自定义多选。
- 表单页不写解释性小字；仅在语义无法自明时保留一句。

## Reference

- `README.md` — user-facing docs, feature list, and the legacy-vs-Expo difference table.
- `legacy/README.md` — original v1.6.2 documentation.
