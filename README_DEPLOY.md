部署与环境变量说明

1) 一步到位：准备 env.template
- 打开 `env.template`，把尖括号内的占位符替换成真实值（尤其是 Mongo 密码必须 URL-encode）。

2) 通过脚本批量写入（需要 vercel CLI）
- 安装 vercel CLI：https://vercel.com/download
- 在项目根运行：
  PowerShell> .\scripts\setup-vercel-envs.ps1
  脚本会提示输入 Vercel token（建议使用 Project-level token），并逐条写入 env。

3) 提交并推送仓库
- 运行：
  PowerShell> .\scripts\git-commit-and-push.ps1
  脚本会提示 commit message、分支和是否推送。

4) 在 Vercel 控制台检查
- 登录 Vercel -> 选择项目 -> Settings -> Environment Variables，确认 Production 环境里变量已被写入并且没有多余的尖括号占位符。
- 如果使用 Git 集成，推送到 main 将会触发自动部署（也可以在 Vercel 控制台手动触发部署）。

5) 验证
- 部署成功后，访问：
  - `https://<your-vercel-project>.vercel.app/api/debug/mongo`  检查后端能否连上 Mongo（返回 diagnostic JSON）。
  - 测试 `/api/sync/list` 与 `/api/sync/user`（需要按代码生成 signature 的请求）。

注意事项：
- 如果部署后的函数无法连接 Mongo，请检查 Atlas IP 白名单或使用 0.0.0.0/0 临时测试（不推荐长期使用）。
- 不要把真实 secrets 写入公开仓库。脚本不会把 secrets 上传到 Git，它只是帮助你写入 Vercel。