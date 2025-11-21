<#
Trigger a GET to /api/sync/list (to reproduce a bad_signature) and then
print the last lines of sync-list-debug.log. Use this instead of pasting
JS into the PowerShell prompt which causes parser errors.

Usage:
  PowerShell -ExecutionPolicy Bypass -File .\scripts\read-sync-list-debug.ps1 -Port 3001
#>

Param(
  [int]$Port = 3001,
  [int]$Tail = 20
)

Set-Location (Split-Path -Parent $PSScriptRoot)

$uri = "http://localhost:$Port/api/sync/list"
Write-Host "Sending GET to: $uri"

try {
  # Attempt request (no signature) to trigger bad_signature logging
  Invoke-RestMethod -Uri $uri -Method GET -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop | ConvertTo-Json -Depth 5 | Write-Host
  Write-Host "Request returned 200 (unexpected). Check response above." -ForegroundColor Yellow
} catch {
  Write-Host "Request failed or returned non-200 (this is expected for bad_signature)." -ForegroundColor Cyan
  if ($_.Exception -and $_.Exception.Response) {
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Response body:`n$body" -ForegroundColor Red
      }
    } catch {
      Write-Host "Could not read response body: $($_.Exception.Message)" -ForegroundColor Red
    }
  } else {
    Write-Host "Error: $($_.Exception.Message)"
  }
}

$logPath = Join-Path -Path (Get-Location) -ChildPath 'sync-list-debug.log'
Write-Host "Checking log file: $logPath"
if (Test-Path $logPath) {
  Write-Host "Last $Tail lines from sync-list-debug.log:" -ForegroundColor Green
  Get-Content -Path $logPath -Tail $Tail | ForEach-Object { Write-Host $_ }
} else {
  Write-Host "Log file not found at $logPath" -ForegroundColor Yellow
}
