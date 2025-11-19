<#
简化版：在仓库根运行。交互式询问 commit message 和分支（默认 main），然后执行 add/commit/push。
用法：在项目根 PowerShell 中运行：
  .\scripts\git-commit-and-push-fixed.ps1
#>

# 检查 git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error '未检测到 git，请先安装 Git 并在项目根运行'
    exit 1
}

$branch = Read-Host '要推送到的分支名 (默认: main)'
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'main' }
$commitMsg = Read-Host '请输入 commit message (默认: Prepare Vercel deploy)'
if ([string]::IsNullOrWhiteSpace($commitMsg)) { $commitMsg = 'Prepare Vercel deploy and env templates' }

Write-Host "当前分支: $(git branch --show-current)"
Write-Host '当前修改摘要:'
git status --short

# 执行 add/commit
git add .
if ($LASTEXITCODE -ne 0) { Write-Error 'git add 失败'; exit 2 }

# 检查是否有 staged changes
$changes = git diff --cached --name-only
if (-not $changes) { Write-Host '没有要提交的变更。'; exit 0 }

git commit -m "$commitMsg"
if ($LASTEXITCODE -ne 0) { Write-Error 'git commit 失败'; exit 3 }

$doPush = Read-Host '是否现在推送到远程? (y/n)'
if ($doPush -eq 'y') {
    git push -u origin $branch
    if ($LASTEXITCODE -ne 0) { Write-Error 'git push 失败，请检查远程/权限'; exit 4 }
    Write-Host '推送成功' -ForegroundColor Green
} else {
    Write-Host '已提交，但未推送。' -ForegroundColor Cyan
}
