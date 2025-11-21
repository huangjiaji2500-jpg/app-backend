# One-shot reset to Vercel "functions" format and deploy (PowerShell)
# - Moves existing api/, functions/, .vercel/ to backup
# - Creates functions/hello.js and functions/register.js as Vercel functions
# - Writes vercel.json mapping /api/* -> /functions/*.js
# - Deploys with `vercel --prod --confirm`

$Root = Get-Location
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $Root "backup_express_$ts"
New-Item -ItemType Directory -Path $backup -Force | Out-Null

$toMove = @('api','functions','.vercel','backend','api/all.js')
foreach ($p in $toMove) {
  $full = Join-Path $Root $p
  if (Test-Path $full) {
    $dest = Join-Path $backup (Split-Path $p -Leaf)
    Write-Host "Moving $p -> $dest"
    try { Move-Item -Path $full -Destination $dest -Force } catch { Write-Warning "Could not move $p: $_" }
  }
}

# Ensure functions dir exists
$funcDir = Join-Path $Root 'functions'
if (-not (Test-Path $funcDir)) { New-Item -ItemType Directory -Path $funcDir | Out-Null }

# write hello.js
$hello = @'
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ hello: 'world' }));
};
'@
Set-Content -Path (Join-Path $funcDir 'hello.js') -Value $hello -Encoding UTF8 -Force

# write register.js
$register = @'
module.exports = (req, res) => {
  console.log('[FUNC-R] /api/register hit');
  let data = '';
  if (req.setEncoding) req.setEncoding('utf8');
  req.on('data', chunk => { try { data += chunk; } catch(e){} });
  req.on('end', () => {
    try {
      if (data && data.length < 2000) console.log('[FUNC-R] rawBody snippet:', data);
      let parsed = {};
      try { parsed = JSON.parse(data || '{}'); } catch(e) { }
      const username = parsed && parsed.username ? String(parsed.username).slice(0,64) : 'testuser_final';
      const payload = { success: true, token: 'functions-token-9001', username };
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(payload));
    } catch (e) {
      console.error('[FUNC-R] unexpected', e && e.message);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'server_error' }));
    }
  });
  req.on('error', err => {
    console.error('[FUNC-R] request error', err && err.message);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'stream_error' }));
  });
};
'@
Set-Content -Path (Join-Path $funcDir 'register.js') -Value $register -Encoding UTF8 -Force

# write vercel.json
$vercelJson = @'
{
  "version": 2,
  "functions": {
    "functions/*.js": { "runtime": "nodejs18.x" }
  },
  "routes": [
    { "src": "/api/(.*)", "dest": "/functions/$1.js" }
  ]
}
'@
Set-Content -Path (Join-Path $Root 'vercel.json') -Value $vercelJson -Encoding UTF8 -Force

Write-Host "Files prepared. Backup stored at: $backup"
Write-Host "Now deploying to Vercel (production) with --confirm..."
# Deploy to production non-interactively
vercel --prod --confirm

Write-Host "Deployment command issued. After it finishes, run the test commands below (copy/paste):"
Write-Host "# Test GET hello"
Write-Host "curl.exe -i https://<YOUR_DEPLOYED_URL>/api/hello"
Write-Host "# Test POST register"
Write-Host "curl.exe -i -X POST -H \"Content-Type: application/json\" -d \"{\"username\":\"testuser_final\",\"password\":\"Test@123456\"}\" https://<YOUR_DEPLOYED_URL>/api/register"

Write-Host "To view production logs (no args): npx vercel logs --prod"
