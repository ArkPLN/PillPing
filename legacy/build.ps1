<#
.SYNOPSIS
    按时吃药 (MedTimer) Windows / PowerShell 7 构建脚本。

.DESCRIPTION
    等价于 build.sh 的 aapt2 -> javac -> d8 -> zip -> zipalign -> apksigner 流程，
    但不依赖 Termux。所有中间产物写入 -BuildDir，最终 APK 写入 -OutDir。

.PARAMETER PatchCert
    把本次签名证书的 SHA-256 写进「构建副本」的 Security.java，
    否则新包启动时会因证书钉扎校验失败而直接退出。
    只改 -BuildDir 里的副本，不会动仓库源码。

.EXAMPLE
    pwsh -File build.ps1 -PatchCert
#>
[CmdletBinding()]
param(
    [string]$BuildDir = (Join-Path $env:TEMP 'medtimer-build'),
    [string]$OutDir = (Join-Path $env:TEMP 'medtimer-out'),
    [string]$AndroidSdk,
    [string]$Keystore,
    [string]$KeyAlias = 'medtimer',
    [string]$StorePass = 'medtimer123',
    [string]$KeyPass = 'medtimer123',
    [int]$VersionCode = 13,
    [string]$VersionName = '1.6.2',
    [int]$MinSdk = 26,
    [int]$TargetSdk = 34,
    [switch]$PatchCert,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot

function Write-Step([string]$Text) {
    Write-Host ''
    Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Fail([string]$Text) {
    Write-Host "错误: $Text" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------- 工具定位

function Resolve-AndroidSdk {
    param([string]$Hint)
    $candidates = @()
    if ($Hint) { $candidates += $Hint }
    foreach ($v in 'ANDROID_SDK_ROOT', 'ANDROID_HOME') {
        $val = [Environment]::GetEnvironmentVariable($v)
        if ($val) { $candidates += $val }
    }
    $candidates += 'D:\dev\andsdk'
    $candidates += (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
    $candidates += (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk')
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c 'build-tools')) -and (Test-Path (Join-Path $c 'platforms'))) {
            return (Resolve-Path $c).Path
        }
    }
    Fail '未找到 Android SDK，请用 -AndroidSdk 指定。'
}

function Get-BuildTools([string]$Sdk) {
    $dir = Join-Path $Sdk 'build-tools'
    $versions = Get-ChildItem $dir -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
        Sort-Object { [version]$_.Name } -Descending
    foreach ($v in $versions) {
        $aapt2 = Join-Path $v.FullName 'aapt2.exe'
        $d8 = Join-Path $v.FullName 'd8.bat'
        $signer = Join-Path $v.FullName 'apksigner.bat'
        $zipalign = Join-Path $v.FullName 'zipalign.exe'
        if ((Test-Path $aapt2) -and (Test-Path $d8) -and (Test-Path $signer) -and (Test-Path $zipalign)) {
            return [pscustomobject]@{
                Version = $v.Name
                Dir = $v.FullName
                Aapt2 = $aapt2
                D8 = $d8
                ApkSigner = $signer
                ZipAlign = $zipalign
            }
        }
    }
    Fail "在 $dir 下没有找到同时具备 aapt2/d8/apksigner/zipalign 的 build-tools。"
}

function Get-AndroidJar([string]$Sdk, [int]$Target) {
    $platforms = Join-Path $Sdk 'platforms'
    $exact = Join-Path $platforms "android-$Target\android.jar"
    if (Test-Path $exact) { return $exact }
    $best = Get-ChildItem $platforms -Directory |
        Where-Object { $_.Name -match '^android-(\d+)$' } |
        Sort-Object { [int]($_.Name -replace '^android-', '') } -Descending |
        Select-Object -First 1
    if (-not $best) { Fail "在 $platforms 下没有可用的 android.jar。" }
    return (Join-Path $best.FullName 'android.jar')
}

function Resolve-JavaHome {
    $javaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME')
    if ($javaHome -and (Test-Path (Join-Path $javaHome 'bin\javac.exe'))) {
        return $javaHome
    }
    $javac = Get-Command javac -ErrorAction SilentlyContinue
    if ($javac) { return (Split-Path (Split-Path $javac.Source -Parent) -Parent) }
    Fail '未找到 JDK（需要 javac），请设置 JAVA_HOME。'
}

# ---------------------------------------------------------------- 打包

function Add-DexToApk([string]$ApkPath, [string]$DexPath) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::Open($ApkPath, [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        $existing = $zip.GetEntry('dex/classes.dex')
        if ($existing) { $existing.Delete() }
        $entry = $zip.CreateEntry('dex/classes.dex', [System.IO.Compression.CompressionLevel]::Optimal)
        $out = $entry.Open()
        try {
            $in = [System.IO.File]::OpenRead($DexPath)
            try { $in.CopyTo($out) } finally { $in.Dispose() }
        } finally { $out.Dispose() }
    } finally {
        $zip.Dispose()
    }
}

function Get-KeystoreSha256([string]$KeyStorePath, [string]$Alias, [string]$Pass) {
    $output = & keytool -list -v -keystore $KeyStorePath -alias $Alias -storepass $Pass 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "读取 keystore 失败: $output" }
    $line = $output | Where-Object { $_ -match '^\s*SHA256:\s*([0-9A-Fa-f:]+)' } | Select-Object -First 1
    if (-not $line) { Fail '无法从 keytool 输出中解析 SHA256。' }
    $null = $line -match 'SHA256:\s*([0-9A-Fa-f:]+)'
    return ($Matches[1] -replace ':', '').ToLowerInvariant()
}

function Get-ExpectedCertHash([string]$JavaFile) {
    $text = Get-Content -LiteralPath $JavaFile -Raw
    if ($text -match 'EXPECTED_SHA256\s*=\s*"([0-9a-fA-F]+)"') { return $Matches[1].ToLowerInvariant() }
    return $null
}

function Set-ExpectedCertHash([string]$JavaFile, [string]$Hash) {
    $text = Get-Content -LiteralPath $JavaFile -Raw
    $updated = [regex]::Replace($text, 'EXPECTED_SHA256\s*=\s*"\s*[0-9a-fA-F]*\s*"', "EXPECTED_SHA256 =`n            `"$Hash`"")
    if ($updated -eq $text) { Fail "无法在 $JavaFile 中定位 EXPECTED_SHA256。" }
    Set-Content -LiteralPath $JavaFile -Value $updated -Encoding utf8 -NoNewline
}

# ---------------------------------------------------------------- 主流程

$sw = [System.Diagnostics.Stopwatch]::StartNew()

Write-Step '环境检查'
$Sdk = Resolve-AndroidSdk -Hint $AndroidSdk
$Tools = Get-BuildTools -Sdk $Sdk
$AndroidJar = Get-AndroidJar -Sdk $Sdk -Target $TargetSdk
$JavaHome = Resolve-JavaHome
$Javac = Join-Path $JavaHome 'bin\javac.exe'
$KeyTool = Join-Path $JavaHome 'bin\keytool.exe'

Write-Host "SDK         : $Sdk"
Write-Host "build-tools : $($Tools.Version)"
Write-Host "android.jar : $AndroidJar"
Write-Host "JDK         : $JavaHome"

if (-not (Test-Path $KeyTool)) { Fail "未找到 keytool: $KeyTool" }
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    $env:PATH = (Join-Path $JavaHome 'bin') + ';' + $env:PATH
}

if (-not $Keystore) {
    $projectKey = Join-Path $ProjectRoot 'signing\medtimer.jks'
    if (Test-Path $projectKey) { $Keystore = $projectKey }
    else { $Keystore = Join-Path $OutDir 'medtimer.jks' }
}
if (-not (Test-Path $Keystore)) {
    $keystoreDir = Split-Path $Keystore -Parent
    if ($keystoreDir -and -not (Test-Path $keystoreDir)) { New-Item -ItemType Directory -Path $keystoreDir -Force | Out-Null }
    Write-Step '生成 keystore'
    & $KeyTool -genkeypair -v -keystore $Keystore -alias $KeyAlias `
        -keyalg RSA -keysize 2048 -validity 10000 `
        -storepass $StorePass -keypass $KeyPass `
        -dname 'CN=MedTimer, OU=Personal, O=DSH, L=Local, ST=Local, C=CN' 2>&1 |
        Select-Object -Last 3 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { Fail 'keystore 生成失败。' }
}
Write-Host "keystore    : $Keystore"

$CertHash = Get-KeystoreSha256 -KeyStorePath $Keystore -Alias $KeyAlias -Pass $StorePass
Write-Host "cert sha256 : $CertHash"

# --- 准备构建目录
Write-Step "准备构建目录 $BuildDir"
if ($Clean -and (Test-Path $BuildDir)) {
    Remove-Item $BuildDir -Recurse -Force
}
$dirs = @(
    $BuildDir,
    (Join-Path $BuildDir 'build\gen'),
    (Join-Path $BuildDir 'build\classes'),
    (Join-Path $BuildDir 'build\dex'),
    $OutDir
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

Copy-Item (Join-Path $ProjectRoot 'res') -Destination $BuildDir -Recurse -Force
Copy-Item (Join-Path $ProjectRoot 'src') -Destination $BuildDir -Recurse -Force
Copy-Item (Join-Path $ProjectRoot 'AndroidManifest.xml') -Destination $BuildDir -Force

$BuildRoot = $BuildDir
$WorkBuild = Join-Path $BuildRoot 'build'
$GenDir = Join-Path $WorkBuild 'gen'
$ClassesDir = Join-Path $WorkBuild 'classes'
$DexDir = Join-Path $WorkBuild 'dex'
$ResZip = Join-Path $WorkBuild 'res.zip'
$UnsignedApk = Join-Path $WorkBuild 'app-unsigned.apk'
$WithDexApk = Join-Path $WorkBuild 'app-with-dex.apk'
$AlignedApk = Join-Path $WorkBuild 'app-aligned.apk'
$FinalApk = Join-Path $OutDir 'medtimer.apk'

# --- 可选：把证书指纹写进构建副本
$SecurityJava = Join-Path $BuildRoot 'src\com\dsh\medtimer\Security.java'
$expected = Get-ExpectedCertHash -JavaFile $SecurityJava
if ($PatchCert) {
    Write-Step 'PatchCert：写入证书指纹'
    Set-ExpectedCertHash -JavaFile $SecurityJava -Hash $CertHash
    Write-Host "Security.EXPECTED_SHA256 -> $CertHash"
}

# --- aapt2 compile
Write-Step 'aapt2 compile'
Push-Location $BuildRoot
try {
    & $Tools.Aapt2 compile --dir res -o $ResZip
    if ($LASTEXITCODE -ne 0) { Fail 'aapt2 compile 失败。' }
}
finally { Pop-Location }

# --- aapt2 link
Write-Step 'aapt2 link'
Push-Location $BuildRoot
try {
    & $Tools.Aapt2 link -o $UnsignedApk `
        -I $AndroidJar `
        --manifest AndroidManifest.xml `
        --java $GenDir `
        --min-sdk-version $MinSdk `
        --target-sdk-version $TargetSdk `
        --version-code $VersionCode `
        --version-name $VersionName `
        $ResZip
    if ($LASTEXITCODE -ne 0) { Fail 'aapt2 link 失败。' }
}
finally { Pop-Location }

# --- javac
Write-Step 'javac'
$sources = @()
$sources += Get-ChildItem (Join-Path $BuildRoot 'src') -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$sources += Get-ChildItem $GenDir -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$sourcesFile = Join-Path $WorkBuild 'sources.txt'
$sources | ForEach-Object { '"' + ($_ -replace '\\', '/') + '"' } |
    Set-Content -LiteralPath $sourcesFile -Encoding utf8
Write-Host "源文件: $($sources.Count) 个"
& $Javac -encoding UTF-8 --release 8 -Xlint:-options `
    -classpath $AndroidJar `
    -d $ClassesDir `
    "@$sourcesFile"
if ($LASTEXITCODE -ne 0) { Fail 'javac 编译失败。' }

# --- d8（先把 class 打成一个 jar，避免 d8 的 @argfile 不认引号、路径含空格时出错）
Write-Step 'd8'
$classFiles = Get-ChildItem $ClassesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
$classesJar = Join-Path $WorkBuild 'classes.jar'
Write-Host "class 文件: $($classFiles.Count) 个"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $classesJar) { Remove-Item $classesJar -Force }
$jar = [System.IO.Compression.ZipFile]::Open($classesJar, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $prefixLen = $ClassesDir.TrimEnd('\', '/').Length + 1
    foreach ($f in $classFiles) {
        $entryName = $f.Substring($prefixLen) -replace '\\', '/'
        $entry = $jar.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $out = $entry.Open()
        try {
            $in = [System.IO.File]::OpenRead($f)
            try { $in.CopyTo($out) } finally { $in.Dispose() }
        } finally { $out.Dispose() }
    }
} finally {
    $jar.Dispose()
}
& $Tools.D8 --release --min-api $MinSdk --lib $AndroidJar --output $DexDir $classesJar
if ($LASTEXITCODE -ne 0) { Fail 'd8 失败。' }

$dexPath = Join-Path $DexDir 'classes.dex'
if (-not (Test-Path $dexPath)) { Fail '未能生成 classes.dex。' }

# --- 打包 dex
Write-Step '打包 classes.dex'
Copy-Item $UnsignedApk $WithDexApk -Force
Add-DexToApk -ApkPath $WithDexApk -DexPath $dexPath
Write-Host "APK: $((Get-Item $WithDexApk).Length) 字节"

# --- zipalign
Write-Step 'zipalign'
& $Tools.ZipAlign -p -f 4 $WithDexApk $AlignedApk
if ($LASTEXITCODE -ne 0) { Fail 'zipalign 失败。' }

# --- 签名
Write-Step 'apksigner sign'
& $Tools.ApkSigner sign `
    --ks $Keystore --ks-key-alias $KeyAlias `
    --ks-pass "pass:$StorePass" --key-pass "pass:$KeyPass" `
    --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true `
    --out $FinalApk $AlignedApk
if ($LASTEXITCODE -ne 0) { Fail 'apksigner 签名失败。' }

# --- 校验
Write-Step '验证'
$verify = & $Tools.ApkSigner verify --verbose --print-certs $FinalApk 2>&1
$verify | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { Fail 'APK 签名校验未通过。' }

$sw.Stop()
Write-Host ''
Write-Host '---------------- 构建完成 ----------------' -ForegroundColor Green
Write-Host ("APK        : {0}" -f $FinalApk)
Write-Host ("大小       : {0:N0} 字节" -f (Get-Item $FinalApk).Length)
Write-Host ("版本       : {0} (versionCode {1})" -f $VersionName, $VersionCode)
Write-Host ("证书指纹   : {0}" -f $CertHash)
if ($PatchCert) {
    Write-Host '证书补丁   : 已写入构建副本（仓库源码未改动）' -ForegroundColor Yellow
}
elseif ($expected -and $expected -ne $CertHash) {
    Write-Host ''
    Write-Host '警告: 证书指纹与 Security.EXPECTED_SHA256 不一致，' -ForegroundColor Yellow
    Write-Host "      APK 安装后启动会提示「应用安全校验失败」并退出。" -ForegroundColor Yellow
    Write-Host "      当前源码期望: $expected" -ForegroundColor Yellow
    Write-Host "      本次实际签名: $CertHash" -ForegroundColor Yellow
    Write-Host "      重新执行并加上 -PatchCert 可自动修正。" -ForegroundColor Yellow
}
elseif ($expected) {
    Write-Host '证书补丁   : 指纹与源码一致，无需修改'
}
Write-Host ("耗时       : {0:N1} 秒" -f $sw.Elapsed.TotalSeconds)
Write-Host '------------------------------------------' -ForegroundColor Green
