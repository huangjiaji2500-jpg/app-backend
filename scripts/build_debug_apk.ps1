<#
本脚本用于在 Windows 上构建 Android 调试 APK（debug）。
前提：
- 你已在本机安装并配置好 Android SDK / Java / Android Studio，且 `ANDROID_HOME` 已设置。
- 已安装 Node.js、npm/yarn、以及项目依赖（运行过 `npm install` 或 `yarn`）。
- 如果是 Expo 管理工作流，请先确认是否使用 `expo prebuild` 或使用 EAS 构建（本脚本针对本地 Gradle 构建）。

用法：以管理员权限在项目根目录运行：
    .\scripts\build_debug_apk.ps1

输出：
- 成功后会在 `android\app\build\outputs\apk\debug\app-debug.apk` 找到 APK。脚本会提示如何用 `adb install -r` 安装到设备。
#>

Set-StrictMode -Version Latest

Write-Host "== 构建调试 APK: 开始 ==" -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

if (!(Test-Path package.json)) {
    Write-Error "未在当前目录找到 package.json，请在项目根目录运行本脚本。"
    Exit 1
}

Write-Host "1) 安装依赖（若尚未安装）..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install 失败，请检查网络和权限后重试。"
    Pop-Location
    Exit 1
}

if (!(Test-Path .\android)) {
    Write-Host "检测到项目没有 android 原生目录，尝试运行 expo prebuild (若使用 Expo 管理工作流)..." -ForegroundColor Yellow
    npx expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "expo prebuild 失败。若你使用 Managed workflow，请考虑使用 EAS 构建（云端）。"
        Pop-Location
        Exit 1
    }
}

Write-Host "2) 启动 Gradle 构建 (assembleDebug) ... 这可能需要几分钟" -ForegroundColor Yellow
Push-Location .\android

if (Test-Path .\gradlew.bat) {
    .\gradlew.bat assembleDebug
} else {
    Write-Host "未找到 gradlew.bat，尝试使用系统 gradle（若已安装）" -ForegroundColor Yellow
    gradle assembleDebug
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Gradle 构建失败。请在 Android Studio 中打开 android 文件夹以查看详细错误。"
    Pop-Location
    Pop-Location
    Exit 1
}

Pop-Location

$apkPath = Join-Path -Path (Join-Path $root 'android\app\build\outputs\apk\debug') -ChildPath 'app-debug.apk'
if (Test-Path $apkPath) {
    Write-Host "构建成功，APK 位于： $apkPath" -ForegroundColor Green
    Write-Host "使用 adb 安装到设备：adb install -r \"$apkPath\"" -ForegroundColor Cyan
} else {
    Write-Error "未找到生成的 APK，请确认构建是否成功并查看 android/app/build/outputs/apk/debug。"
}

Pop-Location
Write-Host "== 构建调试 APK: 完成 ==" -ForegroundColor Cyan
