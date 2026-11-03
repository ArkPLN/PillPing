# Android 截图 / 冒烟管线

用 `uv + Python + adb` 在真机上复现关键页面并留档截图，用于 UI 自测与视觉回归。

驱动走 adb 原生能力：

- 截图：`screencap -p`
- 层级：系统自带 `uiautomator dump`（解析 `text` / `content-desc` / `resource-id` / `bounds`）
- 交互：`input tap` / `input swipe`

> 为什么不用 uiautomator2 的 ATX agent：它在当前 Android 17 真机上初始化时抛出
> `ApplicationSharedMemory not initialized`（`UiDevice.getDisplaySizeDp`），无法使用。
> 原生 adb 路径不需要额外设备端服务，选择器语义与 uiautomator2 一致。

## 前置条件

- `adb` 可用，设备已连接并解锁（`adb devices -l` 能看到 `device`）
- 已安装最新构建：`com.expo.medtimer`
- `uv` 可用（`uv --version`）

## 安装

```bash
uv sync --project tools/android
```

会创建 `tools/android/.venv`，不影响 `yarn test` / Node 依赖。

## 运行

```bash
# 连通性 + 点击注入 + 截图
uv run --project tools/android python tools/android/capture.py --flow smoke

# 添加药物表单：顶部 → 单位弹层 → 选中 → 计划区 → 底部
uv run --project tools/android python tools/android/capture.py --flow add-med --tag after

# 特殊用药表单
uv run --project tools/android python tools/android/capture.py --flow special-form --tag after

# 字体放大复测（结束后自动恢复原值）
uv run --project tools/android python tools/android/capture.py \
  --flow add-med --font-scale 1.15 --tag after-font115
```

输出在 `artifacts/screenshots/<时间>-<tag>-<flow>/`，每张截图同时保存同名 `.xml` 层级文件。

脚本会自动检查文本节点是否越出父容器，发现可疑裁切时打印 `⚠ 可能的文字裁切`；加 `--strict` 可让其以非 0 退出。

## 参数

| 参数 | 说明 |
|---|---|
| `--flow` | `smoke` / `add-med` / `special-form` |
| `--tag` | 输出目录标签，默认 `after` |
| `--out` | 截图根目录，默认 `artifacts/screenshots` |
| `--serial` | 多设备时指定序列号；也可用 `ANDROID_SERIAL` |
| `--font-scale` | 临时系统字体缩放，结束后恢复 |
| `--strict` | 发现文字越界时返回非 0 |

## 选择器约定

| 方式 | 说明 |
|---|---|
| `resource-id` | RN 的 `testID`，如 `med-unit`、`plan-slot-0-unit` |
| `content-desc` | RN 的 `accessibilityLabel`，如 `添加药物`、`单位：粒` |
| `text` | 页面可见文案，如 `粒`、`我的药物` |
| 底部 tab | 按 `content-desc` 后缀 + 屏幕下方 80% 区域定位，避免误点页面里的同名文案 |

## 常见问题

**点击没有反应 / 找不到控件**

HONOR / MagicOS 需要在开发者选项里开启「USB 调试（安全设置）」才能注入点击。仅截图不受影响。

**页面不是最新代码**

当前安装的是 release 包，JS 改动后需要重新构建安装：

```bash
npx expo run:android --variant release
```

**testID 不生效**

`testID` 在 uiautomator 中表现为 `resource-id`（如 `med-unit`）。确认构建包含最新代码后，
可手动检查：

```bash
MSYS_NO_PATHCONV=1 adb shell uiautomator dump /sdcard/window.xml
MSYS_NO_PATHCONV=1 adb shell cat /sdcard/window.xml | grep med-unit
```

Git Bash 下注意加 `MSYS_NO_PATHCONV=1`，否则 `/sdcard/...` 会被改写成 Windows 路径。

**uiautomator dump 偶发失败**

脚本自带重试；如果持续失败，确认屏幕已解锁、没有系统弹窗遮挡。
