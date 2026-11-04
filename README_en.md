# PillPing (按时吃药)

<p align="center">
  <img src="./assets/images/Banner.jpg" alt="PillPing 按时吃药" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo_SDK-57-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/React_Native-0.86-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native 0.86" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/NativeWind-4.2-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="NativeWind 4.2" />
  <br />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-0EA5E9?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3.4" />
  <img src="https://img.shields.io/badge/Zustand-5-2B2B2B?style=for-the-badge" alt="Zustand 5" />
  <img src="https://img.shields.io/badge/Platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/Yarn-4-2C8EBB?style=for-the-badge&logo=yarn&logoColor=white" alt="Yarn 4" />
</p>

<p align="center">
  <a href="./README.md">简体中文</a> · <a href="./README_en.md">English</a>
</p>

A simple, easy-to-use medication reminder built with Expo React Native.

## Tech Stack

| Area | Choice |
| --- | --- |
| Framework | Expo SDK 57 + React Native 0.86 |
| Routing | Expo Router |
| Language | TypeScript + TSX |
| Styling | NativeWind 4.2.7 + Tailwind CSS 3.4 |
| State | zustand 5 + AsyncStorage |
| Notifications | expo-notifications |
| Forms | @react-native-picker/picker + @react-native-community/datetimepicker |
| Icons | @expo/vector-icons |

## Requirements

- Node.js 24+ LTS
- Yarn 4
- Android SDK (required to build a dev client locally)

## Development Commands

```bash
# Enable the package manager
corepack enable
# Install dependencies
yarn install
# Install Expo / native dependencies
npx expo install <package>
# Start the dev server (Android)
npx expo run:android
# Type check
yarn typecheck
# Unit tests (core scheduling algorithm)
yarn test
# Web preview (development preview only; notifications unavailable)
yarn web
```

## Features

### Today

- The header shows today's "taken / total" count and a progress bar; when there are no doses for the day it shows an empty state, and the button reads "添加药物" (Add medication) or "管理药物" (Manage medications) depending on whether any medication exists.
- The timeline is sorted by due time ascending, then by medication name for the same time. Each row shows the time, the time-of-day label, the medication name, the dose amount and the status: due, taken, missed or skipped.
- Taken doses show the actual time taken; missed doses show how long they have been overdue; when a dose was postponed, the postponed due time is shown.
- The next due or missed dose is highlighted; when the highlighted dose is missed, the card turns amber.
- Tapping a dose opens "本次服药" (This dose): record as taken now, postpone 10 minutes, skip this dose, or backfill the actual time taken. A taken or skipped dose can be undone.
- Tapping "记录本次已服" (record as taken) more than 30 minutes before the scheduled time asks for confirmation first.
- The bottom of the page lists the medication summary for the past 3 days (days without doses are hidden) plus the medication entry point, which shows the total number of medications and how many are enabled.
- After 3 consecutive days of use the title changes to a greeting; after 7 days the subtitle shows the current streak. When the reminder master switch is off, "提醒已暂停" (reminders paused) is displayed.

### Medications and Plans

Each medication has its own plan; there is no global dose count or interval anymore. Cards on the medications page show the dosage form, dose amount, administration route, plan summary, course duration and follow-up appointment; the switch on the right disables or enables the medication, and disabled medications stay in the list.

The medication form contains the name, dose per intake (quantity + unit), dosage form, administration route, plan, course duration, follow-up and notes. The quantity accepts values such as "半" (half) and "1.5". Plans come in three types:

- **Daily**: reminders are listed per slot for every day. Each slot can override its time-of-day label (wake-up / morning / noon / evening / before meal / after meal / bedtime), quantity and unit; leaving the quantity empty falls back to the medication-level value, and the unit defaults to the medication-level unit.
- **Weekly**: pick the weekdays that apply; the same set of times is used on those days.
- **Interval**: set the dosing interval (1–72 hours), doses per day (1–12) and the first dose time. The next dose = the medication's most recent **actual** intake time + interval. The number of doses generated per day never exceeds "doses per day", and the chain can cross days. For example, with a 5-hour interval:
  - 1st dose taken at 08:00 → 2nd dose scheduled for 13:00;
  - 2nd dose actually taken at 14:00 → 3rd dose moves to **19:00**;
  - 3rd dose actually taken at 20:30 → 4th dose moves to **01:30**.

The plan editor offers "once / twice / three times a day" templates. The before/after meal option in the template area decides the generated times:

- Once a day: 08:00;
- Twice a day: 08:00, 18:00;
- Three times a day: 08:00, 12:00, 18:00;
- Choosing "before meal" moves each time 30 minutes earlier.

Templates generate new slots, which can be edited one by one after applying. A plan can be saved as a template and applied to another medication in one tap; applying copies it and does not stay linked to the original. The bottom of the editor previews each slot's time and dose live.

The course duration is "number of consecutive days"; 0 disables it. The follow-up reminder can be off, day 1 / 3 / 5, or 1–4 weeks.

### Backfill

On the "本次服药" (This dose) page you can backfill the actual intake time for a dose; the time picker only accepts times before the current moment.

- Daily and weekly plans: the actual intake time is recorded and the scheduled time stays unchanged.
- Interval plans: the backfilled time becomes the new anchor, so the next dose = backfilled time + interval.
- Missed doses can be backfilled too.

Special medications support backfill as well, through the "补登" (backfill) action on their cards.

### Special Medications

The "特殊" (Special) tab at the bottom covers medications that are not taken on a recurring calendar. Special medications remind independently and are not counted in the Today page's dose count or progress. Three shapes are supported:

- **One-off (multiple doses in one day)**: pick a date, then add several times on that day.
- **N times per week**: set a weekly target and a reminder interval (one dose advances every N days). Once the target is reached this week, the next dose is scheduled for next week.
- **Specific dates**: add one or more dates that share a single set of times.

Cards show the shape, the next due time (with how long it is overdue when applicable) and the full rhythm; the switch on the right disables the medication. When a dose is due you can mark it used, postpone it or backfill it. The edit page lists the most recent records and the next due time when records exist.

### Reminders

- Regular medications schedule one notification per medication per slot, 48 hours ahead; interval plans only schedule the next pending dose.
- Special medications only schedule the next dose; follow-ups only schedule the earliest one.
- Notification actions: "已服用" (taken) / "10 分钟后" (in 10 minutes) for regular and special medications; "已复诊" (follow-up done) / "明天再提醒" (remind me tomorrow) for follow-ups.
- Notifications are re-synced on app start, when the app returns to the foreground, and after recording, skipping, postponing, backfilling, saving a plan or toggling a reminder switch.
- The reminder master switch on the settings page pauses regular, special and follow-up reminders while keeping all records.

### Settings

- Reminder master switch.
- Appearance: follow system, light, dark.
- Getting started guide: checks adding medications, notification permission, notification banners, do-not-disturb, exact alarms, background running and vendor auto-start, each with a shortcut; a 10-second background test can be scheduled at the bottom.
- Reminder permission status and shortcuts: notification permission, notification style, do-not-disturb, battery and background, app settings.
- Tests: send now, 10-second background test, preview the next reminder.
- Data: clear today's records (medications and history are kept), clear all data.
- Version information and acknowledgements.

### Upgrade Notes

The storage version is 3 and it is incompatible with the old data structure. After upgrading from an older version, the first launch asks you to add medications and set dosing times again; the "clear all data" action remains available on the settings page.

## Differences from the Legacy Version

| Item | Original Java version | This version |
| --- | --- | --- |
| Scheduling model | One global chain (count + interval + first time) | Per-medication plan (daily / weekly / interval) |
| Alarm model | A single chained alarm (schedule the next one after firing) | One-shot notification per medication per slot, scheduled 48h ahead, fully re-synced on start and state changes |
| Special medications | Interval / daily | One-off / N times per week / specific dates |
| Data migration | — | The v3 structure is incompatible with old data; upgrading resets and asks you to reconfigure |
| Signature pinning | Verifies the APK certificate SHA-256 at startup | Removed; Android v2/v3 signing verifies it at install time |
| Vendor auto-start | Opens the settings page | Also only opens the settings page; the state cannot be read back |
| Time zone changes | BootReceiver listens for TIME_SET | Re-syncs as a fallback when the app returns to the foreground |
| App size | ~117 KB | Estimated 8–15 MB (RN runtime overhead) |

## Background Reminders

The app uses `expo-notifications` local notifications and exact alarms (`SCHEDULE_EXACT_ALARM`); it does not depend on a push service and does not use the network.

Users still need to enable these on the system side:

1. **Notification permission**: Settings → Apps → PillPing → Notifications → Allow notifications
2. **Exact alarms**: Settings → Apps → Special app access → Alarms & reminders → Allow
3. **Background running**: Settings → Battery → Background power management → PillPing → Allow background activity

On Chinese OEM phones (vivo / OPPO / Xiaomi) it is recommended to also allow "auto-start", "high background power consumption" and "show on lock screen". The in-app "开始指南" (getting started guide) checks each item and offers a shortcut.

### Background Test

Settings → **后台测试提醒** (Background test reminder):

1. Tap "测试" (Test);
2. Press Home to leave the app (or lock the screen);
3. Wait 10 seconds.

If you receive "后台测试提醒 · 成功" (background test reminder · success), the background path works.

## Permissions

| Permission | Purpose | If not granted |
| --- | --- | --- |
| `POST_NOTIFICATIONS` | Shows the reminder on time | No reminders |
| `SCHEDULE_EXACT_ALARM` | Fires on the minute | The system may delay by a few minutes |
| `RECEIVE_BOOT_COMPLETED` | Restores scheduled notifications after a reboot | May stop reminding after a reboot |
| `VIBRATE` / `WAKE_LOCK` | Vibration and wake-up | Reminders may be silent |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Prompts to join the battery allowlist | Long background periods may miss reminders |

No `INTERNET` permission.

## Development Notes

- **Web is for development preview only**: `expo-notifications` native features are unavailable on web, and the notification layer automatically degrades to a no-op (see `src/lib/notifications/platform.ts`); `@react-native-community/datetimepicker` does not support web either.
- **Route types**: `experiments.typedRoutes` is enabled; if types are stale after adding a page, delete `.expo/` to regenerate them.
- **Tests**: `src/lib/__tests__/` uses the Node built-in test runner (via `tsx`), isolated from the RN runtime.

## Authors

- Demo author: 肚小圆
- Engineering and maintenance: arkpln

## Disclaimer

This app is only a medication timing reminder and provides no medical diagnosis, prescription or medication advice. Follow your doctor's instructions for the specific medication, dose, administration route and timing; this app accepts no liability.

## Artwork

v2.0 uses `@expo/vector-icons` (Material Icons / Material Community Icons) plus the capsule SVG bundled in this repository. The original Material Symbols assets and their license are in [`legacy/CREDITS.md`](./legacy/CREDITS.md).
