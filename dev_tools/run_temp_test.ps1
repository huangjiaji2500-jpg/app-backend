$API_BASE='http://localhost:3002/api'
$ADMIN_SECRET='sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'
$TARGET_USER_ID='local_seed_jiaji250'
$TARGET_USERNAME='jiaji250'

Write-Host "检查健康： $API_BASE/../health"
try{
    $h=Invoke-RestMethod -Uri "$API_BASE/../health" -TimeoutSec 5
    Write-Host 'health:'
    $h | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host 'health 请求失败:'
    Write-Host $_.Exception.Message
}

Write-Host '开始 admin reset -> login-temp 测试'
$patchUrl = "$API_BASE/admin/users"
$headers = @{ 'x-admin-secret' = $ADMIN_SECRET; 'Content-Type' = 'application/json' }
$body = @{ id = $TARGET_USER_ID; resetPassword = $true } | ConvertTo-Json

try{
    $resp = Invoke-RestMethod -Method Patch -Uri $patchUrl -Headers $headers -Body $body -TimeoutSec 10
    Write-Host 'admin reset 返回:'
    $resp | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host 'admin reset 请求失败:'
    Write-Host $_.Exception.Message
    exit 1
}

$plaintextTemp = $null
if ($resp.update -and $resp.update.tempPassword) { $plaintextTemp = $resp.update.tempPassword } elseif ($resp.tempPassword) { $plaintextTemp = $resp.tempPassword }
if (-not $plaintextTemp) { Write-Host '未从 admin reset 响应中读取到 tempPassword'; exit 1 }

Write-Host "一次性临时密码: $plaintextTemp"

$loginUrl = "$API_BASE/auth/login-temp"
$loginBody = @{ username = $TARGET_USERNAME; password = $plaintextTemp } | ConvertTo-Json
try{
    $loginResp = Invoke-RestMethod -Method Post -Uri $loginUrl -Body $loginBody -Headers @{ 'Content-Type' = 'application/json' } -TimeoutSec 10
    Write-Host '登录返回:'
    $loginResp | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host '临时密码登录失败:'
    Write-Host $_.Exception.Message
    exit 1
}
