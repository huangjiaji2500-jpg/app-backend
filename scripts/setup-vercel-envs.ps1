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
    Write-Error "env.template not found in repository root. Please place env.template at project root."
    exit 1
}

# 询问 Vercel token
Write-Host 'Enter Vercel Token (it will not be echoed)'
$vercelToken = Read-Host -AsSecureString
$vercelTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($vercelToken))
if (-not $vercelTokenPlain) { Write-Error 'No Vercel Token provided, exiting'; exit 2 }

# 检查 vercel CLI 是否存在
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "vercel CLI not found. Please install from https://vercel.com/download" -ForegroundColor Yellow
    $ok = Read-Host 'Continue and only print commands? (y/n)'
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
        Write-Host "Skipping placeholder variable: $key (replace placeholders in env.template first)" -ForegroundColor Yellow
        continue
    }

    $cmd = "vercel env add $key $value production --token $vercelTokenPlain --yes"
    if ($previewOnly) {
        Write-Host "[preview] $cmd"
    } else {
        Write-Host "Running: $cmd"
        & vercel env add $key $value production --token $vercelTokenPlain --yes
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to add $key (exit $LASTEXITCODE)" -ForegroundColor Red
        } else {
            Write-Host "Added $key" -ForegroundColor Green
        }
    }
}

Write-Host "Done. Please verify environment variables in Vercel console." -ForegroundColor Cyan
