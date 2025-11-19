<#
PowerShell 脚本：安全地在仓库根执行 add/commit/push。会提示 commit message 和 remote/branch。
使用前提：在仓库根运行此脚本。
运行示例：
  PowerShell> .\scripts\git-commit-and-push.ps1
#>

Param()

function Read-LineWithDefault {
    param($prompt, $default)
    $ans = Read-Host "$prompt [$default]"
    if ([string]::IsNullOrWhiteSpace($ans)) { return $default }
    return $ans
}

# 检查是否为 git 仓库
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Error '未检测到 git 命令，请先安装 Git 并在项目根运行'; exit 1 }
$root = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0) { Write-Error '当前目录不是 Git 仓库根，请切换到仓库根后再运行此脚本'; exit 2 }

# 显示当前分支和状态
Write-Host "当前分支: $(git branch --show-current)"
Write-Host "当前修改摘要:"
git status --short

$commitMsg = Read-LineWithDefault '输入 Commit message' 'Prepare Vercel deploy and env templates'
$branch = Read-LineWithDefault '要推送到的分支名' 'main'

# 如果 remote 不存在，提示设置
$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host '未检测到远程 origin。请提供远程仓库 URL（HTTPS）或先用 git remote add origin 添加。'
    $remoteUrl = Read-Host '远程仓库 URL (留空则跳过 push)'
    if (-not [string]::IsNullOrWhiteSpace($remoteUrl)) {
        git remote add origin $remoteUrl
    } else {
        Write-Host '跳过 push 步骤（未配置远程）' -ForegroundColor Yellow
    }
}

# 执行 add/commit
git add .
if ($LASTEXITCODE -ne 0) { Write-Error 'git add 失败'; exit 3 }

# 如果没有可提交的变更，提示并退出
$changes = git diff --cached --name-only
if (-not $changes) { Write-Host '没有要提交的变更。'; exit 0 }

git commit -m "$commitMsg"
if ($LASTEXITCODE -ne 0) { Write-Error 'git commit 失败，可能没有变更或冲突'; exit 4 }

# push
$doPush = Read-LineWithDefault '是否现在推送到远程？(y/n)' 'y'
if ($doPush -eq 'y') {
    # 如果远程不存在，会提示
    git push -u origin $branch
    if ($LASTEXITCODE -ne 0) { Write-Error 'git push 失败，请检查远程和权限'; exit 5 }
    Write-Host '推送成功' -ForegroundColor Green
} else {
    Write-Host '已提交，但未推送。' -ForegroundColor Cyan
}
