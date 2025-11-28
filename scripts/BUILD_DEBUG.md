## 本地构建 Android 调试 APK（Debug）指南

概述：
- 如果你在本机有 Android SDK 和 Java 环境，可以直接用 Gradle 在本地构建 debug APK 并安装到手机或模拟器。脚本 `build_debug_apk.ps1` 会帮你做大部分工作。

先决条件：
- Windows: 已安装 Java（JDK 11+ 推荐）和 Android SDK。
- 确保 `ANDROID_HOME`（或 `ANDROID_SDK_ROOT`）环境变量已设置，并且 `platform-tools` 在 PATH（以便使用 `adb`）。
- 已安装 Node.js 和 npm/yarn，并在项目根目录运行过 `npm install`。
- 若使用 Expo 管理工作流且没有 `android/` 目录，脚本会尝试运行 `expo prebuild`（需要安装 `expo-cli` 或使用 `npx expo`）。

快速开始（在项目根目录，通过 PowerShell 运行）：

```powershell
# 1. 在项目根目录运行脚本（以管理员身份或普通用户均可）：
.\scripts\build_debug_apk.ps1

# 2. 脚本成功后，会打印 APK 路径，例如：
# android\app\build\outputs\apk\debug\app-debug.apk

# 3. 使用 adb 安装到设备（设备需通过 USB 调试连接或在同一 ADB 网络）：
adb install -r android\app\build\outputs\apk\debug\app-debug.apk

# 4. 如果要收集设备日志以供我分析，运行：
adb logcat ReactNative:V ReactNativeJS:V *:S > rn_log.txt
# 在触发注册操作后，停止并上传 rn_log.txt 的最后 500 行。
```

常见问题：
- 如果 Gradle 构建失败，请在 `android` 目录打开 Android Studio，按提示安装 SDK 组件并运行一次同步。
- 如果你使用 Expo 的 EAS 构建（云端），请使用 EAS 提供的证书与配置，这脚本不处理 EAS。若想我可以添加 `eas.json` 或 CI 配置说明。

若你希望我自动触发构建并把 APK 上传到仓库 Releases（需你提供 GitHub token 或 CI 权限），我可以帮你添加 GitHub Actions 工作流文件。
