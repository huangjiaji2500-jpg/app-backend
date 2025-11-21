$base = 'https://app-tau-gilt-23.vercel.app'
$secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6'
$max = 10
for($i=1; $i -le $max; $i++){
    Write-Output "\n=== Attempt $i / $max ==="
    try{
        $r = Invoke-WebRequest -Uri "$base/api/public/platform-config" -Method GET -UseBasicParsing -ErrorAction Stop
        Write-Output "platform-config Status: $($r.StatusCode)"
        if($r.StatusCode -eq 200){ Write-Output "platform-config OK"; break }
        Write-Output "platform-config Body: $($r.Content)"
    } catch {
        if($_.Exception.Response){ $resp = $_.Exception.Response; try{ $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $reader.ReadToEnd(); Write-Output "platform-config ErrorStatus: $($resp.StatusCode)"; Write-Output "platform-config ErrorBody: $body" } catch { Write-Output "platform-config Error: $($_.Exception.Message)" } } else { Write-Output "platform-config Error: $($_.Exception.Message)" }
    }
    Start-Sleep -Seconds 12
}
Write-Output "\nDone polling."
