# USDT Trading App – Remote Sync & Hot Updates

轻量安全的 USDT 出售/充值 App（Expo RN）。当前已实现：
- 平台最小下单额度（默认 200，可在后台修改）
- 后台访问防护（普通用户完全不可见）
- 远端同步（orders / deposits / users / paymentMethods / rates / platformDeposit）
- 免费实时数据互通（Vercel 无服务器 + HTTPS + HMAC 签名）
- 本地备份/恢复、一键重试、崩溃兜底（ErrorBoundary）
- Expo EAS 热更新（自动检测/下载 + 提示重启）

## 关键操作指南

1. 修改最小兑换金额：个人中心 -> 后台管理 -> 最小兑换金额(USDT) -> 保存
2. 管理员入口：仅管理员账号在个人中心看到“后台管理”。普通账号不可见，也无法跳转。
3. 订单扣减/拒绝退款：下单即扣 USDT；管理员拒绝后自动退回。
4. 远端同步：默认不阻断本地操作。配置了域名与密钥后，后台“远端数据”面板可查看远端统计、重试队列、合并数据。
5. 热更新：App 启动自动检测更新 → 后台静默下载 → 顶部条提示“新版本已就绪” → 点击重启应用。

## 远端配置（可选）

1. 在 `app.json` -> `expo.extra` 中设置：
   - `remoteBaseUrl`: Vercel 域名（例如 `https://xxx.vercel.app`）
   - `syncSecret`: 自定义签名密钥（>=12 位随机字符串）
2. 部署 `api/sync/*` 全部文件到 Vercel（或直接整仓库部署）。
3. 管理员后台 -> 远端数据 面板点击“刷新远端”。
4. 修改任意本地对象（如新增支付方式）后，可在网络正常时自动上行，或点击“重试未送达”。

## 本地备份/恢复

1. 进入 个人中心 -> 数据备份/恢复
2. 复制文本保存；恢复时粘贴回输入框，点击“立即恢复”。

## 安全测试清单（手测）

1. 非管理员：
   - Tab、个人中心无“后台管理”入口
   - 手动执行 `navigation.navigate('AdminDashboard')` 无法进入，回到首页
2. 管理员：
   - 可访问后台页面；最小兑换金额修改成功；非管理员调用接口会提示 not_admin
3. 订单：
   - 下单余额立即扣减；拒绝后退回；通过后不重复扣减
4. 远端：
   -- 未配置域名/密钥不影响下单
   -- 配置后，后台“远端数据”显示计数与合并操作
   5. 热更新：
      - 有新版本时出现下载与就绪提示
      - 下载失败不影响正常使用（10 分钟内不重复尝试）

## 版本号与更新

当前 `app.json` 版本：1.0.1（runtimeVersion=Expo SDK）

### 发布热更新示例
```powershell
eas update --branch production --message "feat: 同步面板优化"
```

### 查看/回滚
```powershell
eas update:list --branch production
eas update:rollbacks --branch production
```

出现严重问题回滚后，用户下次冷启动即应用旧版本。

### 远端同步关键函数 (src/services/remoteSync.js)
- queueUserSnapshot(userMeta)
- queuePaymentMethodSync(paymentMethod)
- queueRateSync(rate)
- queuePlatformDepositSync(platformDeposit)
- fetchRemoteLatest()
- mergeRemoteData(remote)

### 合并策略摘要
- 用户：仅在远端 updatedAt 更新时同步 lastLoginAt 等非敏感字段
- 支付方式：按 id + updatedAt；冲突多默认时保留最新 updatedAt 的默认，其它取消
- 平台收款地址：远端较新即覆盖
- Rates：当前仅拉取保留，不写入本地

### 后续优化方向
- Rates 趋势图与缓存
- 支付方式软删除标记与多端冲突提示
- 合并时 diff UI 可视化
- 增加加密层（除签名外再加密敏感字段）
