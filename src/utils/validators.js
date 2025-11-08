// 简易地址校验：满足格式与长度（测试版按“表层格式校验 + 人工复核”）

// TRC20 地址通常是base58，长度34，以 T 开头
export function isValidTRC20(address) {
  if (typeof address !== 'string') return false;
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

// ERC20 (以太坊) 地址 0x + 40位十六进制
export function isValidERC20(address) {
  if (typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidUSDTAddress({ network = 'TRC20', address }) {
  if (network === 'TRC20') return isValidTRC20(address);
  if (network === 'ERC20') return isValidERC20(address);
  return false;
}