# 非交互式 git 提交并推送脚本（默认 message）
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error '未检测到 git，请先安装 Git 并在项目根运行'
    exit 1
}

$defaultMsg = 'Prepare Vercel deploy and env templates'

Write-Host "当前分支: $(git branch --show-current)"
Write-Host '当前修改摘要:'
git status --short

git add .
if ($LASTEXITCODE -ne 0) { Write-Error 'git add 失败'; exit 2 }

$changes = git diff --cached --name-only
if (-not $changes) { Write-Host '没有要提交的变更。'; exit 0 }

$tmpFile = [IO.Path]::GetTempFileName()
Set-Content -Path $tmpFile -Value $defaultMsg -Encoding UTF8
git commit -F $tmpFile
Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
if ($LASTEXITCODE -ne 0) { Write-Error 'git commit 失败'; exit 3 }

# 检查 remote origin
$origin = git remote get-url origin 2>$null
if ($origin) {
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { Write-Error 'git push failed'; exit 4 }
    Write-Host 'push succeeded' -ForegroundColor Green
} else {
    Write-Host 'origin not found, skipping push' -ForegroundColor Yellow
}
