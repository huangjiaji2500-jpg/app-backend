<#
交互式 Vercel 部署脚本（在项目根运行）
用法：在项目根 PowerShell 中运行：
  .\scripts\vercel-deploy-interactive.ps1
脚本会：
 - 检查 vercel CLI
 - 提示粘贴 Vercel token（输入将被隐藏）
 - 运行 `vercel --prod --confirm --token <token>` 并把输出流回终端
#>

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host 'vercel CLI not found. Please install from https://vercel.com/download and ensure `vercel` is on PATH.' -ForegroundColor Yellow
    exit 1
}

Write-Host 'Please paste your Vercel token below (input will be hidden), then press Enter:'
$secure = Read-Host -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if (-not $token) { Write-Error 'No token provided, aborting.'; exit 2 }

Write-Host 'Triggering vercel production deployment...'
# Run vercel and stream output
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = 'vercel'
$startInfo.Arguments = "--prod --confirm --token $token"
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.UseShellExecute = $false
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $startInfo
$proc.Start() | Out-Null

# Use asynchronous read to avoid deadlocks when the child process writes to stderr/stdout
# Attach event handlers and begin async read; then wait for the process to exit.
$proc.add_OutputDataReceived({ param($sender,$event) if ($event.Data) { Write-Host $event.Data } })
$proc.add_ErrorDataReceived({ param($sender,$event) if ($event.Data) { Write-Host $event.Data } })
$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()

$proc.WaitForExit()
$exit = $proc.ExitCode
if ($exit -ne 0) { Write-Error "vercel exited with code $exit"; exit $exit }
Write-Host 'vercel deploy finished.' -ForegroundColor Green
