// 应用配置入口
// USE_LOCAL_AUTH 可通过构建时注入环境变量 REACT_NATIVE_APP_USE_LOCAL_AUTH
// 在生产环境默认关闭本地模拟（即默认 false），开发环境默认开启，除非显式设置为 'false'
const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

const USE_LOCAL_AUTH = (() => {
  if (env.REACT_NATIVE_APP_USE_LOCAL_AUTH === 'true') return true;
  if (env.REACT_NATIVE_APP_USE_LOCAL_AUTH === 'false') return false;
  // 默认：production => false, 其它环境 => true
  return (env.NODE_ENV === 'production') ? false : true;
})();

module.exports = {
  USE_LOCAL_AUTH,
};
