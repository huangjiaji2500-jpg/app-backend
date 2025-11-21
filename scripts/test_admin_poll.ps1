$base = 'https://app-tau-gilt-23.vercel.app'
$secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'
$max = 12
for($i=1; $i -le $max; $i++){
    Write-Output "\n=== Attempt $i / $max ==="
    try{
        $r = Invoke-WebRequest -Uri "$base/api/admin/users" -Method GET -Headers @{ 'x-admin-secret' = $secret } -UseBasicParsing -ErrorAction Stop
        Write-Output "admin/users Status: $($r.StatusCode)"
        if($r.StatusCode -eq 200){ Write-Output "admin/users OK"; Write-Output "Content:\n$($r.Content)"; break }
        Write-Output "admin/users Body: $($r.Content)"
    } catch {
        if($_.Exception.Response){ $resp = $_.Exception.Response; try{ $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "admin/users ErrorStatus: $($resp.StatusCode)"; Write-Output "admin/users ErrorBody: $body" } catch { Write-Output "admin/users Error: $($_.Exception.Message)" } } else { Write-Output "admin/users Error: $($_.Exception.Message)" }
    }
    Start-Sleep -Seconds 8
}
Write-Output "\nDone polling admin/users."