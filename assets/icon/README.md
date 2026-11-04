# 应用图标源文件

图标以 legacy Android 版为参考，用 SVG 还原后再生成 PNG：

| 源文件 | 用途 |
|---|---|
| `app-icon.svg` | 完整图标（渐变底 + 胶囊 + 时钟 + 装饰圆环） |
| `app-icon-foreground.svg` | Android 自适应图标前景（透明背景） |
| `app-icon-background.svg` | Android 自适应图标背景（315° 青色渐变） |
| `app-icon-monochrome.svg` | Android 13+ 主题图标（单色轮廓，省略渐变圆环） |
| `notification-icon.svg` | 通知栏铃铛（原版 `ic_notification.xml`） |

几何来源：

- `legacy/res/drawable/ic_launcher_bg.xml`：`#0B5D56 → #0D9488` 的 315° 渐变。
- `legacy/res/drawable/ic_launcher_fg.xml`：白色胶囊绕 `(54,54)` 旋转 `-38°`，时钟位于 `(74,34)`。
- 额外增加一层从左上浅青渐变到右下透明的圆环，保持简洁并增加层次。

## 生成

ImageMagick 的 SVG 渲染在处理「胶囊 + 光圈」叠加时会裁掉胶囊右端，因此使用 sharp（librsvg）渲染：

```bash
npm i --no-save sharp
node tools/icons/render-icons.mjs
```

输出会覆盖 `assets/images/` 下的：

- `icon.png`（1024×1024）
- `android-icon-foreground.png`（1024×1024）
- `android-icon-background.png`（1024×1024）
- `android-icon-monochrome.png`（1024×1024）
- `splash-icon.png`（1024×1024）
- `favicon.png`（48×48）
- `notification-icon.png`（96×96）

修改 SVG 后重新执行上述命令即可。
