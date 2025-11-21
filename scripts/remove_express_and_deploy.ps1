# PowerShell 一键脚本：备份并移除 Express 相关代码，创建 Vercel 原生路由并部署 Preview
# 说明：脚本不会永久删除文件，而是把可能的 Express 相关目录/文件移动到一个备份文件夹
# 使用方法：在仓库根（C:\Users\Administrator\Desktop\制作APP）运行：
#    .\scripts\remove_express_and_deploy.ps1

$pwd = Get-Location
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $pwd "express_backup_$timestamp"
Write-Host "Backup path: $backupDir"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# List of candidate Express-related items to move (if they exist)
$items = @(
  "backend",
  "api/all.js",
  "api/public/platform-config.js",
  "api/[...all].js",
  "backend/server.js",
  "backend/routes",
  "backend/models",
  "backend/package.json"
)

foreach ($it in $items) {
  $full = Join-Path $pwd $it
  if (Test-Path $full) {
    $dest = Join-Path $backupDir (Split-Path $it -Leaf)
    Write-Host "Moving $it -> $dest"
    try {
      Move-Item -Path $full -Destination $dest -Force
    } catch {
      Write-Warning "Failed to move $it: $_"
    }
  }
}

# Ensure api directory exists
$apiDir = Join-Path $pwd 'api'
if (-not (Test-Path $apiDir)) { New-Item -ItemType Directory -Path $apiDir | Out-Null }

# Create minimal native routes to guarantee Vercel recognizes them
$helloPath = Join-Path $apiDir 'hello.js'
$registerPath = Join-Path $apiDir 'register.js'

# hello.js
$helloContent = @'
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ hello: 'world' }));
};
'@
Set-Content -Path $helloPath -Value $helloContent -Force -Encoding UTF8

# register.js
$registerContent = @'
module.exports = (req, res) => {
  console.log('[VERCEL-R] /api/register hit');
  let data = '';
  if (req.setEncoding) req.setEncoding('utf8');
  req.on('data', chunk => { try { data += chunk; } catch(e){} });
  req.on('end', () => {
    try {
      if (data && data.length < 2000) console.log('[VERCEL-R] rawBody snippet:', data);
      let parsed = {};
      try { parsed = JSON.parse(data || '{}'); } catch(e) { }
      const username = parsed && parsed.username ? String(parsed.username).slice(0,64) : 'testuser_final';
      const payload = { success: true, token: 'vercel-native-token-0001', username };
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(payload));
    } catch (e) {
      console.error('[VERCEL-R] unexpected', e && e.message);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'server_error' }));
    }
  });
  req.on('error', err => {
    console.error('[VERCEL-R] request error', err && err.message);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'stream_error' }));
  });
};
'@
Set-Content -Path $registerPath -Value $registerContent -Force -Encoding UTF8

Write-Host "Created native routes: /api/hello and /api/register"

# Deploy Preview (assumes vercel CLI installed & logged in)
Write-Host "Starting Vercel Preview deploy..."
vercel --yes

Write-Host "Deployed. Now you can test endpoints. Example tests (copy/paste):"
Write-Host "1) GET /api/hello"
Write-Host "   curl.exe -i $($env:COMPUTERNAME) -UseBasicParsing" -NoNewline
Write-Host "   (See README for manual examples)"

Write-Host "Script finished. Backup of moved items is at: $backupDir"
