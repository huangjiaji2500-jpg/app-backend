<#
PowerShell 脚本：从项目根的 env.template 读取 KEY=VALUE 行并用 vercel CLI 批量写入 Vercel 环境变量（Production 环境）。
使用前提：已安装 `vercel` CLI，并在运行时提供 Vercel token。
运行示例：
  PowerShell> .\scripts\setup-vercel-envs.ps1
#>

Param()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$envFile = Join-Path $scriptDir "..\env.template" | Resolve-Path -ErrorAction SilentlyContinue
if (-not $envFile) {
    Write-Error "找不到 env.template（期望在仓库根）。请把 env.template 放在项目根。"
    exit 1
}

# 询问 Vercel token
$vercelToken = Read-Host -Prompt '请输入 Vercel Token（不会回显）' -AsSecureString
$vercelTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($vercelToken))
if (-not $vercelTokenPlain) { Write-Error '未输入 Vercel Token，退出'; exit 2 }

# 检查 vercel CLI 是否存在
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "未检测到 vercel CLI。请先安装：https://vercel.com/download" -ForegroundColor Yellow
    $ok = Read-Host '继续并仅打印将要执行的命令？(y/n)'
    if ($ok -ne 'y') { exit 3 }
    $previewOnly = $true
} else { $previewOnly = $false }

$lines = Get-Content $envFile | Where-Object { $_ -and ($_ -notmatch '^\s*#') }
foreach ($line in $lines) {
    $trim = $line.Trim()
    if (-not ($trim -match '=')) { continue }
    $parts = $trim -split '=', 2
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($value -match '^<.*>$') {
        Write-Host "跳过占位符变量：$key（请先把 env.template 中的占位符替换为真实值）" -ForegroundColor Yellow
        continue
    }

    $cmd = "vercel env add $key $value production --token $vercelTokenPlain --yes"
    if ($previewOnly) {
        Write-Host "[预览] $cmd"
    } else {
        Write-Host "执行：$cmd"
        & vercel env add $key $value production --token $vercelTokenPlain --yes
        if ($LASTEXITCODE -ne 0) {
            Write-Host "添加 $key 失败 (exit $LASTEXITCODE)" -ForegroundColor Red
        } else {
            Write-Host "已添加 $key" -ForegroundColor Green
        }
    }
}

Write-Host "完成。请在 Vercel 控制台确认变量值是否正确。" -ForegroundColor Cyan
