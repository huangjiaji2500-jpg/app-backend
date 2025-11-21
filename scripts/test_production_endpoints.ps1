Param(
  [string]$Domain = 'https://app-tau-gilt-23.vercel.app'
)

function Write-Success($msg){ Write-Host $msg -ForegroundColor Green }
function Write-Fail($msg){ Write-Host $msg -ForegroundColor Red }
function Write-Info($msg){ Write-Host $msg -ForegroundColor Yellow }

$savedUserFile = "$env:TEMP\app_test_user.txt"
$tokenFile = "$env:TEMP\app_jwt.txt"
$password = 'P@ssw0rd123!'

Write-Info "Starting one-click production endpoint tests against: $Domain"
Write-Host "(temporary user saved to $savedUserFile, token saved to $tokenFile)" -ForegroundColor DarkCyan

function Test-PublicPlatformConfig {
  Write-Info "\n=> Testing public endpoint: /api/public/platform-config"
  try {
    $r = Invoke-RestMethod -Uri "$Domain/api/public/platform-config" -Method Get -TimeoutSec 30
  } catch {
    Write-Fail "Request failed: $($_.Exception.Message)"
    return $false
  }
  $json = $r | ConvertTo-Json -Depth 10
  Write-Host $json
  if ($r.displayRates -or $r.platformDeposit) {
    Write-Success "PASS: /api/public/platform-config returned displayRates or platformDeposit"
    return $true
  } else {
    Write-Fail "FAIL: /api/public/platform-config did not contain expected fields (displayRates/platformDeposit)"
    return $false
  }
}

function Do-Register {
  Write-Info "\n=> Testing register endpoint: /api/register"
  $attempt = 0
  while ($attempt -lt 3) {
    $attempt++
    $user = "testuser$([int](Get-Date -UFormat %s))"
    $payload = @{ username = $user; password = $password; displayName = '自动化测试用户'; email = "$($user)@example.com" }
    $json = $payload | ConvertTo-Json
    try {
      $resp = Invoke-RestMethod -Uri "$Domain/api/register" -Method Post -Body $json -Headers @{ 'Content-Type' = 'application/json' } -TimeoutSec 30
    } catch {
      Write-Fail "Register request failed: $($_.Exception.Message)"
      return $false
    }
    $respJson = $resp | ConvertTo-Json -Depth 10
    Write-Host $respJson
    if ($resp.token -or $resp.success -or $resp.ok -or $resp.user) {
      Write-Success "PASS: register succeeded for username: $user"
      $user | Out-File -FilePath $savedUserFile -Encoding utf8
      return $true
    } else {
      # try again if username collision or similar
      Write-Fail "Register did not return success token/user. Response saved above."
      return $false
    }
  }
  return $false
}

function Do-Login {
  Write-Info "\n=> Testing login endpoint: /api/login"
  if (Test-Path $savedUserFile) { $user = Get-Content $savedUserFile -Raw } else { Write-Fail "No saved user found at $savedUserFile. Please run register first or set username manually." ; return $false }
  $payload = @{ username = $user.Trim(); password = $password }
  $json = $payload | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Uri "$Domain/api/login" -Method Post -Body $json -Headers @{ 'Content-Type' = 'application/json' } -TimeoutSec 30
  } catch {
    Write-Fail "Login request failed: $($_.Exception.Message)"
    return $false
  }
  $resp | ConvertTo-Json -Depth 10 | Write-Host
  if ($resp.token -or $resp.accessToken -or $resp.jwt) {
    $token = $resp.token ? $resp.token : ($resp.accessToken ? $resp.accessToken : $resp.jwt)
    $token | Out-File -FilePath $tokenFile -Encoding utf8
    Write-Success "PASS: login succeeded for $user (token saved)"
    return $true
  } else {
    Write-Fail "FAIL: login response did not contain token."
    return $false
  }
}

function Test-Me {
  Write-Info "\n=> Testing authenticated endpoint: /api/me"
  if (-not (Test-Path $tokenFile)) { Write-Fail "Token file not found ($tokenFile). Run login first."; return $false }
  $token = Get-Content $tokenFile -Raw
  try {
    $r = Invoke-RestMethod -Uri "$Domain/api/me" -Method Get -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 30
  } catch {
    Write-Fail "Request failed: $($_.Exception.Message)"
    return $false
  }
  $r | ConvertTo-Json -Depth 10 | Write-Host
  if ($r.user -or $r.id -or $r.username) {
    Write-Success "PASS: /api/me returned user data"
    return $true
  } else {
    Write-Fail "FAIL: /api/me did not return expected user fields"
    return $false
  }
}

# Run sequence
$results = @{}
$results.public = Test-PublicPlatformConfig
if (-not $results.public) { Write-Fail "公共接口测试失败，后续测试将继续（可能依赖后端配置）。" }
$results.register = Do-Register
if (-not $results.register) { Write-Fail "注册失败，登录将无法继续。" }
$results.login = if ($results.register) { Do-Login } else { $false }
if (-not $results.login) { Write-Fail "登录失败，/api/me 将无法测试。" }
$results.me = if ($results.login) { Test-Me } else { $false }

Write-Host "\n=== 测试总结 ==="
foreach ($k in $results.Keys) { if ($results[$k]) { Write-Success "$k : PASS" } else { Write-Fail "$k : FAIL" } }

if ($results.public -and $results.register -and $results.login -and $results.me) { Write-Success "全部测试通过 ✔" ; exit 0 } else { Write-Fail "部分或全部测试失败 ✖" ; exit 2 }
