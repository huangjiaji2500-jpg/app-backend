$base = 'https://app-tau-gilt-23.vercel.app'
$secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'

Write-Output "=== GET /api/public/platform-config ==="
try {
    $r = Invoke-RestMethod -Uri "$base/api/public/platform-config" -Method GET -ErrorAction Stop
    Write-Output (ConvertTo-Json $r -Depth 6)
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}

Write-Output ""
Write-Output "=== GET /api/admin/users ==="
try {
    $r = Invoke-RestMethod -Uri "$base/api/admin/users" -Method GET -Headers @{ 'x-admin-secret' = $secret } -ErrorAction Stop
    Write-Output (ConvertTo-Json $r -Depth 6)
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}

Write-Output ""
Write-Output "=== GET /api/admin/payments ==="
try {
    $r = Invoke-RestMethod -Uri "$base/api/admin/payments" -Method GET -Headers @{ 'x-admin-secret' = $secret } -ErrorAction Stop
    Write-Output (ConvertTo-Json $r -Depth 6)
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
