$base = 'https://app-tau-gilt-23.vercel.app'
$secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'
try{
    $r = Invoke-RestMethod -Uri "$base/api/admin/payments" -Headers @{ 'x-admin-secret' = $secret } -Method GET -ErrorAction Stop
    Write-Output (ConvertTo-Json $r -Depth 6)
}catch{
    if($_.Exception.Response){
        $resp = $_.Exception.Response
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Output "ERROR_STATUS: $($resp.StatusCode)"
        Write-Output "ERROR_BODY:"
        Write-Output $body
    } else {
        Write-Output "ERROR: $($_.Exception.Message)"
    }
}
