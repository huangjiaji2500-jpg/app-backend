$base = 'https://app-tau-gilt-23.vercel.app'
$secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'

function Show($url, $headers){
    Write-Output "=== $url ==="
    try{
        $r = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -UseBasicParsing -ErrorAction Stop
        Write-Output "Status: $($r.StatusCode)"
        Write-Output "Content:\n$($r.Content)"
    } catch {
        if($_.Exception.Response){ $resp = $_.Exception.Response; try{ $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "ErrorStatus: $($resp.StatusCode)"; Write-Output "ErrorBody: $body" } catch { Write-Output "Error: $($_.Exception.Message)" } } else { Write-Output "Error: $($_.Exception.Message)" }
    }
}

Show "$base/api/admin" @{ 'x-admin-secret' = $secret }
Show "$base/api/admin/" @{ 'x-admin-secret' = $secret }
Show "$base/api/admin/set-platform-config" @{ 'x-admin-secret' = $secret }
Show "$base/api/admin/users" @{ 'x-admin-secret' = $secret }
Show "$base/api/admin/payments" @{ 'x-admin-secret' = $secret }
