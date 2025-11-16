const { generateTempAndHash, verifyTempPassword } = require('../lib/temp-password');

describe('临时密码生成与验证（reset -> login）', () => {
  test('生成的 stored 包含 salt$derived 格式且能被验证', () => {
    const { temp, stored } = generateTempAndHash();
    expect(typeof temp).toBe('string');
    expect(temp.length).toBe(8);
    expect(typeof stored).toBe('string');
    expect(stored.includes('$')).toBe(true);

    // 验证成功
    const ok = verifyTempPassword(stored, temp);
    expect(ok).toBe(true);

    // 错误密码验证失败
    const bad = verifyTempPassword(stored, temp + 'x');
    expect(bad).toBe(false);
  });
});
