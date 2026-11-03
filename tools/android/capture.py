#!/usr/bin/env python3
"""Android screenshot / smoke harness for 按时吃药 (Expo).

用法：
    uv sync --project tools/android
    uv run --project tools/android python tools/android/capture.py --flow smoke
    uv run --project tools/android python tools/android/capture.py --flow add-med --tag after

驱动走 adb：
- 截图：adb 的 `screencap -p`（adbutils 封装）
- 层级：系统自带的 `uiautomator dump`，解析 text / content-desc / resource-id / bounds
- 交互：`input tap` / `input swipe`

之所以不用 uiautomator2 的 ATX agent：它在当前 Android 17 真机上初始化时报
`ApplicationSharedMemory not initialized`（UiDevice.getDisplaySizeDp），无法使用。
原生 adb 路径不需要额外设备端服务，选择器语义与 uiautomator2 一致。

每次截图会同时保存层级 XML，并检查文本节点是否越出父容器（用于发现文字被裁切）。
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from adbutils import adb
from PIL import Image

APP_PACKAGE = os.environ.get("MEDTIMER_PACKAGE", "com.expo.medtimer")
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "artifacts" / "screenshots"
BOUNDS_RE = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")


class FlowError(RuntimeError):
    """UI 流程断言失败。"""


# ---------------------------------------------------------------------------
# 设备 / 层级
# ---------------------------------------------------------------------------


@dataclass
class UiNode:
    text: str
    desc: str
    rid: str
    cls: str
    clickable: bool
    bounds: tuple[int, int, int, int]

    @property
    def center(self) -> tuple[int, int]:
        left, top, right, bottom = self.bounds
        return (left + right) // 2, (top + bottom) // 2


def _rid_matches(actual: str, expected: str) -> bool:
    return (
        actual == expected
        or actual.endswith(f":id/{expected}")
        or actual.endswith(f"/{expected}")
    )


class AdbUi:
    def __init__(self, serial: str | None = None):
        self.device = adb.device(serial=serial) if serial else adb.device()
        size = self.device.window_size()
        self.width = int(size.width)
        self.height = int(size.height)
        self.serial = self.device.serial

    def shell(self, cmd: str) -> str:
        return str(self.device.shell(cmd)).strip()

    def dump(self, retries: int = 6) -> str:
        last = ""
        for _ in range(retries):
            try:
                self.device.shell("uiautomator dump /sdcard/window_dump.xml")
                xml = str(self.device.shell("cat /sdcard/window_dump.xml"))
                if xml.lstrip().startswith("<?xml"):
                    ET.fromstring(xml)
                    return xml
                last = xml[:200]
            except Exception as exc:  # noqa: BLE001 - 设备侧错误信息原样保留
                last = str(exc)
            time.sleep(0.6)
        raise FlowError(f"无法抓取 UI 层级: {last}")

    def nodes(self) -> list[UiNode]:
        root = ET.fromstring(self.dump())
        result: list[UiNode] = []
        for node in root.iter("node"):
            match = BOUNDS_RE.search(node.attrib.get("bounds", ""))
            if not match:
                continue
            left, top, right, bottom = (int(x) for x in match.groups())
            result.append(
                UiNode(
                    text=(node.attrib.get("text") or "").strip(),
                    desc=(node.attrib.get("content-desc") or "").strip(),
                    rid=(node.attrib.get("resource-id") or "").strip(),
                    cls=node.attrib.get("class", ""),
                    clickable=node.attrib.get("clickable") == "true",
                    bounds=(left, top, right, bottom),
                )
            )
        return result

    def find(
        self,
        *,
        text: str | None = None,
        rid: str | None = None,
        desc: str | None = None,
        desc_suffix: str | None = None,
        bottom: bool = False,
        visible_only: bool = True,
        timeout: float = 12,
    ) -> UiNode | None:
        deadline = time.time() + timeout
        while True:
            for node in self.nodes():
                if text is not None and node.text != text:
                    continue
                if rid is not None and not _rid_matches(node.rid, rid):
                    continue
                if desc is not None and node.desc != desc:
                    continue
                if desc_suffix is not None and not node.desc.endswith(desc_suffix):
                    continue
                if bottom and node.bounds[1] < self.height * 0.8:
                    continue
                if node.bounds[2] <= 0 or node.bounds[3] <= 0:
                    continue
                if node.bounds[1] >= self.height or node.bounds[0] >= self.width:
                    continue
                if visible_only and (
                    node.bounds[0] < 0
                    or node.bounds[1] < 0
                    or node.bounds[2] > self.width
                    or node.bounds[3] > self.height
                ):
                    continue
                return node
            if time.time() >= deadline:
                return None
            time.sleep(0.4)

    def tap(self, node: UiNode) -> None:
        x, y = node.center
        self.shell(f"input tap {x} {y}")
        time.sleep(0.5)

    def tap_text(self, text: str, timeout: float = 12) -> bool:
        node = self.find(text=text, timeout=timeout)
        if node is None:
            return False
        self.tap(node)
        return True

    def tap_desc(self, desc: str, timeout: float = 12) -> bool:
        node = self.find(desc=desc, timeout=timeout)
        if node is None:
            return False
        self.tap(node)
        return True

    def tap_id(self, rid: str, timeout: float = 15) -> None:
        node = self.find(rid=rid, timeout=timeout)
        if node is None:
            raise FlowError(
                f"找不到控件 {rid}。请确认已安装最新包，"
                "并且系统已允许 USB 调试（安全设置）的输入注入。"
            )
        self.tap(node)

    def swipe_up(self, scale: float = 0.7) -> None:
        x = self.width // 2
        start_y = int(self.height * 0.78)
        end_y = int(self.height * (0.78 - 0.5 * scale))
        self.shell(f"input swipe {x} {start_y} {x} {end_y} 350")
        time.sleep(0.7)

    def swipe_down(self, scale: float = 0.35) -> None:
        x = self.width // 2
        start_y = int(self.height * 0.4)
        end_y = int(self.height * (0.4 + 0.5 * scale))
        self.shell(f"input swipe {x} {start_y} {x} {end_y} 350")
        time.sleep(0.7)

    def text_or_desc(self, rid: str) -> str:
        node = self.find(rid=rid, timeout=6)
        if node is None:
            return ""
        return node.desc or node.text

    def wait_text(self, text: str, timeout: float = 15) -> bool:
        return self.find(text=text, timeout=timeout) is not None

    def wait_any_text(self, texts, timeout: float = 20) -> str | None:
        end = time.time() + timeout
        while time.time() < end:
            for text in texts:
                if self.find(text=text, timeout=0.1) is not None:
                    return text
            time.sleep(0.3)
        return None


# ---------------------------------------------------------------------------
# 截图与层级检查
# ---------------------------------------------------------------------------


def clipped_texts(xml: str, label: str) -> list[str]:
    """找出文本节点越出最近父容器边界的情况（文字被裁切的信号）。"""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []

    warnings: list[str] = []
    screen_match = BOUNDS_RE.search(root.attrib.get("bounds", ""))
    screen = tuple(int(x) for x in screen_match.groups()) if screen_match else (0, 0, 0, 0)

    def parse(value: str):
        match = BOUNDS_RE.search(value or "")
        return tuple(int(x) for x in match.groups()) if match else None

    def walk(node, parent_bounds):
        bounds = parse(node.attrib.get("bounds", ""))
        text = (node.attrib.get("text") or "").strip()
        cls = node.attrib.get("class", "")
        if text and bounds and parent_bounds and "android.widget" in cls:
            left, top, right, bottom = bounds
            pleft, ptop, pright, pbottom = parent_bounds
            outside = (
                left < pleft - 1
                or top < ptop - 1
                or right > pright + 1
                or bottom > pbottom + 1
            )
            on_screen = (
                right > screen[0]
                and left < screen[2]
                and bottom > screen[1]
                and top < screen[3]
            )
            if outside and on_screen:
                warnings.append(
                    f"{label}: text={text!r} bounds={bounds} parent={parent_bounds}"
                )
        for child in node:
            walk(child, bounds or parent_bounds)

    walk(root, None)
    return warnings[:30]


def capture(ui: AdbUi, out_dir: Path, name: str, warnings: list[str]) -> Path:
    image = ui.device.screenshot()
    if not isinstance(image, Image.Image):
        raise FlowError("截图失败：adbutils 返回的不是 PIL Image")
    png = out_dir / f"{name}.png"
    image.save(png)

    xml = ui.dump()
    (out_dir / f"{name}.xml").write_text(xml, encoding="utf-8")
    warnings.extend(clipped_texts(xml, name))
    print(f"  📸 {png.name}  {image.size[0]}x{image.size[1]}")
    return png


def assert_contains(actual: str, expected: str, message: str) -> None:
    if expected not in actual:
        raise FlowError(f"{message}: 实际 text/desc={actual!r}")
    print(f"  ✅ {message}")


# ---------------------------------------------------------------------------
# 流程
# ---------------------------------------------------------------------------


def current_focus(ui: AdbUi) -> str:
    for line in ui.shell("dumpsys window").splitlines():
        if "mCurrentFocus" in line:
            return line.strip()
    return ""


def launch(ui: AdbUi) -> None:
    print(f"启动 {APP_PACKAGE} ...")
    # 设备可能刚锁屏 / 通知栏处于展开状态；先唤醒、收通知栏、回桌面，再显式启动。
    ui.shell("input keyevent KEYCODE_WAKEUP")
    time.sleep(0.3)
    try:
        ui.shell("wm dismiss-keyguard")
    except Exception:  # noqa: BLE001
        pass
    time.sleep(0.3)
    try:
        ui.shell("cmd statusbar collapse")
    except Exception:  # noqa: BLE001
        pass
    ui.shell("input keyevent KEYCODE_HOME")
    time.sleep(0.8)

    try:
        ui.device.app_stop(APP_PACKAGE)
    except Exception:  # noqa: BLE001 - 未运行时忽略
        pass
    try:
        ui.device.app_start(APP_PACKAGE)
    except Exception:  # noqa: BLE001 - 回退到 monkey
        ui.shell(f"monkey -p {APP_PACKAGE} -c android.intent.category.LAUNCHER 1")

    for _ in range(24):
        if APP_PACKAGE in current_focus(ui):
            break
        time.sleep(0.5)
    else:
        ui.shell(f"monkey -p {APP_PACKAGE} -c android.intent.category.LAUNCHER 1")
        time.sleep(1.5)

    if not ui.wait_any_text(["今日", "服药提醒"], timeout=25):
        raise FlowError(
            "App 启动后未看到首页（当前焦点: "
            f"{current_focus(ui)}）；请确认包名、安装版本和设备未锁屏"
        )
    time.sleep(0.6)


def tap_tab(ui: AdbUi, label: str) -> None:
    if not ui.tap_desc(label, timeout=0.1):
        node = ui.find(desc_suffix=label, bottom=True, timeout=10)
        if node is None:
            raise FlowError(f"找不到底部 tab「{label}」")
        ui.tap(node)
    time.sleep(0.5)


def open_add(ui: AdbUi, label: str, fallback_texts) -> None:
    if ui.tap_desc(label, timeout=8):
        return
    for text in fallback_texts:
        if ui.tap_text(text, timeout=3):
            return
    raise FlowError(f"找不到入口 {label!r}；请确认当前页面和输入注入权限")


def scroll_to(ui: AdbUi, rid: str, max_swipes: int = 10, bottom_margin: int = 140):
    """把目标控件滚到完全可见且避开底部手势区，返回节点。"""
    for _ in range(max_swipes):
        node = ui.find(rid=rid, visible_only=False, timeout=0.5)
        if node is None:
            ui.swipe_up(0.8)
            continue
        top, bottom = node.bounds[1], node.bounds[3]
        if top < 0:
            ui.swipe_down(0.35)
        elif bottom > ui.height - bottom_margin:
            ui.swipe_up(0.8)
        else:
            return node
    return None


def flow_smoke(ui: AdbUi, out_dir: Path, warnings: list[str]) -> None:
    launch(ui)
    capture(ui, out_dir, "01-home", warnings)

    tap_tab(ui, "药物")
    if not ui.wait_text("我的药物", timeout=12):
        raise FlowError("点击后未进入药物页；输入注入可能被系统拦截")
    capture(ui, out_dir, "02-meds", warnings)
    print("✅ smoke: 启动、导航、截图、点击注入均可用")


def flow_add_med(ui: AdbUi, out_dir: Path, warnings: list[str]) -> None:
    launch(ui)
    tap_tab(ui, "药物")
    if not ui.wait_text("我的药物", timeout=12):
        raise FlowError("未进入药物页")
    time.sleep(0.8)
    open_add(ui, "添加药物", ["＋  添加药物", "添加第一种药"])

    # 页面切换动画期间的首击偶尔会被吞掉，重试一次。
    if ui.find(rid="med-name", timeout=10) is None:
        time.sleep(0.5)
        open_add(ui, "添加药物", ["＋  添加药物", "添加第一种药"])
        if ui.find(rid="med-name", timeout=12) is None:
            raise FlowError("未进入「添加药物」页（找不到 med-name）")
    capture(ui, out_dir, "01-form-top", warnings)

    # 每次用量单位：验证长下拉改为底部网格
    ui.tap_id("med-unit")
    if not ui.wait_text("单位", timeout=10):
        raise FlowError("单位选择弹层没有打开")
    capture(ui, out_dir, "02-unit-sheet", warnings)
    if not ui.tap_text("粒"):
        raise FlowError("单位弹层里找不到「粒」")
    time.sleep(0.6)
    capture(ui, out_dir, "03-unit-selected", warnings)
    assert_contains(ui.text_or_desc("med-unit"), "粒", "med-unit 已更新为「粒」")

    ui.swipe_up()
    capture(ui, out_dir, "04-plan", warnings)
    ui.swipe_up()
    capture(ui, out_dir, "05-plan-slots", warnings)

    # 剂量行单位：验证单行布局与紧凑触发器
    if scroll_to(ui, "plan-slot-0-unit", max_swipes=8):
        ui.tap_id("plan-slot-0-unit")
        if not ui.wait_text("单位", timeout=10):
            raise FlowError("剂量行单位弹层没有打开")
        capture(ui, out_dir, "06-slot-unit-sheet", warnings)
        if not ui.tap_text("袋"):
            raise FlowError("剂量行单位弹层里找不到「袋」")
        time.sleep(0.6)
        capture(ui, out_dir, "07-slot-unit-selected", warnings)
        assert_contains(
            ui.text_or_desc("plan-slot-0-unit"),
            "袋",
            "plan-slot-0-unit 已更新为「袋」",
        )

    if scroll_to(ui, "med-save", max_swipes=8):
        capture(ui, out_dir, "08-form-bottom", warnings)
    else:
        print("  ⚠ 未看到保存按钮，可能还没滚到底")


def flow_special_form(ui: AdbUi, out_dir: Path, warnings: list[str]) -> None:
    launch(ui)
    tap_tab(ui, "特殊")
    if not ui.wait_text("特殊用药", timeout=12):
        raise FlowError("未进入特殊用药页")
    time.sleep(0.8)
    open_add(ui, "添加特殊用药", ["＋  添加特殊用药", "添加特殊用药"])

    if ui.find(rid="special-name", timeout=10) is None:
        time.sleep(0.5)
        open_add(ui, "添加特殊用药", ["＋  添加特殊用药", "添加特殊用药"])
        if ui.find(rid="special-name", timeout=12) is None:
            raise FlowError("未进入「添加特殊用药」页（找不到 special-name）")
    capture(ui, out_dir, "01-form-top", warnings)

    ui.tap_id("special-unit")
    if not ui.wait_text("单位", timeout=10):
        raise FlowError("单位选择弹层没有打开")
    capture(ui, out_dir, "02-unit-sheet", warnings)
    if not ui.tap_text("粒"):
        raise FlowError("单位弹层里找不到「粒」")
    time.sleep(0.6)
    capture(ui, out_dir, "03-unit-selected", warnings)
    assert_contains(ui.text_or_desc("special-unit"), "粒", "special-unit 已更新为「粒」")

    if scroll_to(ui, "special-save", max_swipes=8):
        capture(ui, out_dir, "04-form-bottom", warnings)


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------


def get_font_scale(ui: AdbUi) -> str:
    try:
        return ui.shell("settings get system font_scale")
    except Exception:  # noqa: BLE001
        return ""


def set_font_scale(ui: AdbUi, value: str) -> None:
    ui.shell(f"settings put system font_scale {value}")
    time.sleep(1.0)


def main() -> int:
    parser = argparse.ArgumentParser(description="按时吃药 Android 截图 / 冒烟管线")
    parser.add_argument(
        "--flow",
        choices=["smoke", "add-med", "special-form"],
        default="smoke",
        help="要执行的流程",
    )
    parser.add_argument("--tag", default="after", help="输出目录标签，如 before/after")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="截图根目录")
    parser.add_argument(
        "--serial", default=os.environ.get("ANDROID_SERIAL"), help="设备序列号"
    )
    parser.add_argument(
        "--font-scale",
        dest="font_scale",
        default=None,
        help="临时设置系统字体缩放（如 1.15），结束后自动恢复",
    )
    parser.add_argument(
        "--strict", action="store_true", help="发现文字越界时以非 0 退出"
    )
    args = parser.parse_args()

    out_dir = Path(args.out) / f"{datetime.now():%Y%m%d-%H%M%S}-{args.tag}-{args.flow}"
    out_dir.mkdir(parents=True, exist_ok=True)

    ui = AdbUi(args.serial)
    print(f"设备: {ui.serial}  {ui.width}x{ui.height}")

    original_scale = get_font_scale(ui)
    if original_scale:
        print(f"字体缩放: {original_scale}")
    if args.font_scale:
        print(f"临时设置字体缩放 -> {args.font_scale}")
        set_font_scale(ui, args.font_scale)

    warnings: list[str] = []
    try:
        if args.flow == "smoke":
            flow_smoke(ui, out_dir, warnings)
        elif args.flow == "add-med":
            flow_add_med(ui, out_dir, warnings)
        elif args.flow == "special-form":
            flow_special_form(ui, out_dir, warnings)
    except FlowError as exc:
        print(f"\n❌ {exc}", file=sys.stderr)
        print(f"截图目录: {out_dir}")
        return 1
    finally:
        if args.font_scale and original_scale:
            set_font_scale(ui, original_scale)
            print(f"字体缩放已恢复: {original_scale}")

    print(f"\n输出目录: {out_dir}")
    if warnings:
        print(f"\n⚠ 可能的文字裁切 {len(warnings)} 处（最多显示 30 条）:")
        for warning in warnings[:30]:
            print(f"  - {warning}")
        if args.strict:
            return 2
    else:
        print("\n✅ 未发现文字越界")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
