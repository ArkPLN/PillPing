<#
.SYNOPSIS
    配置本机 Android 开发环境变量（用户级，持久生效）。

.DESCRIPTION
    幂等地写入 ANDROID_HOME / ANDROID_SDK_ROOT / JAVA_HOME，
    并把 adb、sdkmanager、emulator、java、gradle 所在目录追加到用户 PATH。
    已存在且值正确的项不会重复写入。

    同时生成 .env（仅本机使用，已在 .gitignore 中忽略）并写入
    android/local.properties（Gradle 读取 SDK 位置）。

.EXAMPLE
    pwsh -File scripts\setup-android-env.ps1
    pwsh -File scripts\setup-android-env.ps1 -SdkRoot D:\dev\andsdk -JdkRoot D:\dev\android\jbr
#>
[CmdletBinding()]
param(
    [string]$SdkRoot = 'D:\dev\andsdk',
    [string]$JdkRoot = 'D:\dev\android\jbr',
    [string]$GradleBin,
    [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Text) {
    Write-Host ''
    Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Fail([string]$Text) {
    Write-Host "错误: $Text" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------- 校验

Write-Step '校验目录'
$required = @(
    $SdkRoot,
    (Join-Path $SdkRoot 'platform-tools'),
    (Join-Path $SdkRoot 'cmdline-tools\latest\bin'),
    (Join-Path $SdkRoot 'emulator'),
    (Join-Path $SdkRoot 'build-tools'),
    (Join-Path $SdkRoot 'platforms'),
    $JdkRoot,
    (Join-Path $JdkRoot 'bin')
)

foreach ($p in $required) {
    if (-not (Test-Path $p)) { Fail "目录不存在: $p" }
    Write-Host "  OK  $p"
}

# 确认 JDK 里确实有 javac
if (-not (Test-Path (Join-Path $JdkRoot 'bin\javac.exe'))) {
    Fail "$JdkRoot 不是有效的 JDK（缺少 bin\javac.exe）"
}

# Gradle 目录（可选）
if (-not $GradleBin) {
    $gradleCmd = Get-Command gradle -ErrorAction SilentlyContinue
    if ($gradleCmd) { $GradleBin = Split-Path $gradleCmd.Source -Parent }
    elseif (Test-Path 'D:\dev\gradle\bin') { $GradleBin = 'D:\dev\gradle\bin' }
}
if ($GradleBin -and -not (Test-Path $GradleBin)) {
    Write-Host "  跳过不存在的 Gradle 目录: $GradleBin" -ForegroundColor Yellow
    $GradleBin = $null
}

# ---------------------------------------------------------------- 环境变量

Write-Step '写入用户级环境变量'
$vars = [ordered]@{
    ANDROID_HOME     = $SdkRoot
    ANDROID_SDK_ROOT = $SdkRoot
    JAVA_HOME        = $JdkRoot
}

foreach ($k in $vars.Keys) {
    $current = [Environment]::GetEnvironmentVariable($k, 'User')
    if ($current -eq $vars[$k]) {
        Write-Host "  保持  $k = $current"
    } else {
        if ($WhatIfOnly) {
            Write-Host "  将写入 $k : $current -> $($vars[$k])" -ForegroundColor Yellow
        } else {
            [Environment]::SetEnvironmentVariable($k, $vars[$k], 'User')
            Write-Host "  写入  $k = $($vars[$k])  (原值: $current)"
        }
    }
}

Write-Step '追加用户 PATH'
$pathDirs = @(
    (Join-Path $SdkRoot 'platform-tools'),
    (Join-Path $SdkRoot 'cmdline-tools\latest\bin'),
    (Join-Path $SdkRoot 'emulator'),
    (Join-Path $JdkRoot 'bin')
)
if ($GradleBin) { $pathDirs += $GradleBin }

$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($null -eq $userPath) { $userPath = '' }
$items = @($userPath -split ';' | Where-Object { $_ })

$toAdd = @()
foreach ($d in $pathDirs) {
    if (-not (Test-Path $d)) { continue }
    if ($items -contains $d) {
        Write-Host "  已在  $d"
    } else {
        $toAdd += $d
    }
}

if ($toAdd.Count -eq 0) {
    Write-Host '  PATH 无需变更'
} elseif ($WhatIfOnly) {
    $toAdd | ForEach-Object { Write-Host "  将追加 $_" -ForegroundColor Yellow }
} else {
    $newPath = (@($items) + $toAdd) -join ';'
    [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
    $toAdd | ForEach-Object { Write-Host "  追加  $_" }
}

# ---------------------------------------------------------------- .env.local
#
# 为什么是 .env.local 而不是 .env：
# @expo/env 把 ANDROID_HOME / ANDROID_SDK_ROOT / JAVA_HOME 视为「个人/机器级」
# 变量（isLocalEnvKey），只允许从 .local 结尾的文件加载；写在 .env 会直接报错
# "Refused to load personal environment variables from a non-.local env file"。
# 另外 PATH 被 @expo/env 完全屏蔽，只能配在系统环境变量里。

Write-Step '生成 .env.local'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot '.env.local'

$envContent = @"
# 本机 Android 开发环境变量（由 scripts/setup-android-env.ps1 生成）
# 必须是 .local 结尾：Expo 只从 .local 文件加载个人/机器级变量
# 已在 .gitignore 中忽略

ANDROID_HOME=$SdkRoot
ANDROID_SDK_ROOT=$SdkRoot
JAVA_HOME=$JdkRoot
"@

if ($WhatIfOnly) {
    Write-Host "  将写入 $envPath" -ForegroundColor Yellow
} else {
    Set-Content -LiteralPath $envPath -Value $envContent -Encoding utf8 -NoNewline
    Write-Host "  写入  $envPath"
}

# ---------------------------------------------------------------- local.properties

$androidDir = Join-Path $projectRoot 'android'
if (Test-Path $androidDir) {
    Write-Step '写入 android/local.properties'
    $localProps = Join-Path $androidDir 'local.properties'
    # Gradle 要求 Windows 路径中的反斜杠被转义
    $escaped = $SdkRoot -replace '\\', '\\'
    $line = "sdk.dir=$escaped"

    if ($WhatIfOnly) {
        Write-Host "  将写入 $line" -ForegroundColor Yellow
    } else {
        Set-Content -LiteralPath $localProps -Value $line -Encoding ascii -NoNewline
        Write-Host "  写入  $line"
    }
} else {
    Write-Host ''
    Write-Host '  android/ 尚未生成（运行 npx expo run:android 时会自动创建），跳过 local.properties' -ForegroundColor Yellow
}

# ---------------------------------------------------------------- 汇总

Write-Step '完成'
Write-Host '当前用户级变量：'
foreach ($k in @('ANDROID_HOME', 'ANDROID_SDK_ROOT', 'JAVA_HOME')) {
    Write-Host ("  {0,-16} = {1}" -f $k, [Environment]::GetEnvironmentVariable($k, 'User'))
}
Write-Host ''
Write-Host '注意：新开一个终端（或重启 IDE）后环境变量才会生效；' -ForegroundColor Yellow
Write-Host '      当前会话可执行：$env:PATH = [Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [Environment]::GetEnvironmentVariable("PATH","User")' -ForegroundColor Yellow
