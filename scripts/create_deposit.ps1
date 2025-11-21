$base = 'https://app-tau-gilt-23.vercel.app'
$syncSecret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'
$payload = @{ ts = [int64]((Get-Date).ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds; action = 'test'; item = @{ username = 'testuser_local'; amountApprovedUSDT = 5; status = 'pending' } }
$payloadJson = (ConvertTo-Json $payload -Depth 10)
# compute sha256 hex
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
$sha = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha.ComputeHash($bytes)
$signature = ([System.BitConverter]::ToString($hashBytes)).Replace('-','').ToLower() + '|' # <-- careful, handler expects base = JSON + '|' + secret then hash; we need to compute hash of (JSON + '|' + secret)
# Recompute correctly
$combined = $payloadJson + '|' + $syncSecret
$hashBytes2 = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($combined))
$signature2 = ([System.BitConverter]::ToString($hashBytes2)).Replace('-','').ToLower()
Write-Output "Payload: $payloadJson"
Write-Output "Signature: $signature2"

try{
    $r = Invoke-RestMethod -Uri "$base/api/sync/deposit" -Method POST -Headers @{ 'x-sync-signature' = $signature2 } -Body $payloadJson -ContentType 'application/json' -ErrorAction Stop
    Write-Output "Response: $(ConvertTo-Json $r -Depth 6)"
}catch{
    if($_.Exception.Response){ $resp = $_.Exception.Response; $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "ErrorStatus: $($resp.StatusCode)"; Write-Output $body } else { Write-Output "Error: $($_.Exception.Message)" }
}
