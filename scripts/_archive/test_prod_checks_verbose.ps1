$base = 'https://app-tau-gilt-23.vercel.app'
$secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'

function Dump($resp){
    if($null -eq $resp){ Write-Output '<no response>'; return }
    try{ Write-Output "StatusCode: $($resp.StatusCode)" }catch{}
    try{ Write-Output "RawContent: $($resp.Content)" }catch{}
}

Write-Output "=== GET /api/public/platform-config ==="
try {
    $r = Invoke-WebRequest -Uri "$base/api/public/platform-config" -Method GET -ErrorAction Stop
    Dump $r
} catch {
    if($_.Exception.Response){
        $resp = $_.Exception.Response
        try{ $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "ErrorStatus: $($resp.StatusCode)"; Write-Output "ErrorBody: $body" } catch { Write-Output "Error: $($_.Exception.Message)" }
    } else { Write-Output "ERROR: $($_.Exception.Message)" }
}

Write-Output "\n=== GET /api/admin/users ==="
try {
    $r = Invoke-WebRequest -Uri "$base/api/admin/users" -Method GET -Headers @{ 'x-admin-secret' = $secret } -ErrorAction Stop
    Dump $r
} catch {
    if($_.Exception.Response){
        $resp = $_.Exception.Response
        try{ $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "ErrorStatus: $($resp.StatusCode)"; Write-Output "ErrorBody: $body" } catch { Write-Output "Error: $($_.Exception.Message)" }
    } else { Write-Output "ERROR: $($_.Exception.Message)" }
}

Write-Output "\n=== GET /api/admin/payments ==="
try {
    $r = Invoke-WebRequest -Uri "$base/api/admin/payments" -Method GET -Headers @{ 'x-admin-secret' = $secret } -ErrorAction Stop
    Dump $r
} catch {
    if($_.Exception.Response){
        $resp = $_.Exception.Response
        try{ $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "ErrorStatus: $($resp.StatusCode)"; Write-Output "ErrorBody: $body" } catch { Write-Output "Error: $($_.Exception.Message)" }
    } else { Write-Output "ERROR: $($_.Exception.Message)" }
}
