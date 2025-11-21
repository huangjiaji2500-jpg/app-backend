$admin = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'
$addr = 'TYfGGw8W2YPX3edLwQL5sMBBA57TuntQwu'
$payload = @{
  platformDeposit = @{
    address = $addr
    qrImage = ''
    note = '仅接收 USDT(TRC20)'
    updatedAt = ([int][double]::Parse((Get-Date -UFormat %s)) * 1000)
  }
} | ConvertTo-Json -Depth 6

try{
  $res = Invoke-RestMethod -Uri 'https://app-tau-gilt-23.vercel.app/api/admin/set-platform-config' -Method POST -Body $payload -ContentType 'application/json' -Headers @{ 'x-admin-secret' = $admin }
  Write-Output 'SET RESPONSE:'
  $res | ConvertTo-Json -Depth 6 | Write-Output
} catch {
  Write-Output "SET ERROR: $_"
}

Start-Sleep -Seconds 1

try{
  $cfg = Invoke-WebRequest -Uri 'https://app-tau-gilt-23.vercel.app/api/public/platform-config' -Method GET -UseBasicParsing
  Write-Output 'PLATFORM-CONFIG:'
  Write-Output $cfg.Content
} catch {
  Write-Output "GET ERROR: $_"
}
