$base = 'https://app-tau-gilt-23.vercel.app'
$secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'
$paymentId = '7Tvvs6MotjIh79APIm5X'

Write-Output "Fetch payment list and find payment $paymentId"
try{
    $payments = Invoke-RestMethod -Uri "$base/api/admin/payments" -Headers @{ 'x-admin-secret' = $secret } -Method GET -ErrorAction Stop
    $p = $payments.payments | Where-Object { $_._id -eq $paymentId }
    if(-not $p){ Write-Output "Payment id not found in list"; exit 1 }
    $username = $p.payload.item.username
    $amount = [double]($p.payload.item.amountApprovedUSDT -or $p.payload.item.amountApproved -or $p.payload.item.amount -or $p.payload.item.amountRequestedUSDT -or 0)
    Write-Output "Found payment for user: $username amount: $amount"
}catch{
    Write-Output "Failed to fetch payments: $($_.Exception.Message)"; exit 1
}

# fetch user before
Write-Output "\nFetch user before approval"
try{
    $u0 = Invoke-RestMethod -Uri ("$base/api/admin/users?id={0}" -f [uri]::EscapeDataString($username)) -Headers @{ 'x-admin-secret' = $secret } -Method GET -ErrorAction Stop
    Write-Output (ConvertTo-Json $u0 -Depth 6)
}catch{
    Write-Output "Failed to fetch user: $($_.Exception.Message)"; exit 1
}

# Approve the payment
Write-Output "\nApproving payment $paymentId ..."
try{
    $body = @{ id = $paymentId; action = 'approved'; adminNote = 'auto-approve-test' } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/api/admin/payments" -Method PATCH -Headers @{ 'x-admin-secret' = $secret; 'Content-Type' = 'application/json' } -Body $body -ErrorAction Stop
    Write-Output "Approve response: $(ConvertTo-Json $r -Depth 4)"
}catch{
    if($_.Exception.Response){ $resp = $_.Exception.Response; $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "Approve failed status: $($resp.StatusCode)"; Write-Output $body } else { Write-Output "Approve failed: $($_.Exception.Message)" }
    exit 1
}

Start-Sleep -Seconds 3

# fetch user after
Write-Output "\nFetch user after approval"
try{
    $u1 = Invoke-RestMethod -Uri ("$base/api/admin/users?id={0}" -f [uri]::EscapeDataString($username)) -Headers @{ 'x-admin-secret' = $secret } -Method GET -ErrorAction Stop
    Write-Output (ConvertTo-Json $u1 -Depth 6)
}catch{
    Write-Output "Failed to fetch user after approval: $($_.Exception.Message)"; exit 1
}

Write-Output "\nDone."