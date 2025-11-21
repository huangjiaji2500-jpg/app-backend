<#
Start vercel dev with SYNC_SECRET set in the same session.
Usage:
  # interactive prompt
  .\scripts\start-vercel-dev-with-secret.ps1 -Port 3001

  # or pass secret as argument
  .\scripts\start-vercel-dev-with-secret.ps1 -Port 3001 -Secret 'mysecret'
#>

param(
  [int]$Port = 3001,
  [string]$Secret
)

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not $Secret) {
  Write-Host 'Enter SYNC_SECRET (input will be hidden):'
  $secure = Read-Host -AsSecureString
  $Secret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

if (-not $Secret) { Write-Error 'No secret provided, aborting.'; exit 2 }

$env:SYNC_SECRET = $Secret
Write-Host "SYNC_SECRET set in this session. Starting vercel dev on port $Port..." -ForegroundColor Green

# Start vercel dev in the current session so it inherits $env:SYNC_SECRET
& npx vercel dev --listen $Port --local-config vercel.dev.json
