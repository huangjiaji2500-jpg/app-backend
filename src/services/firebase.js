// 真实 Firebase 接入（可选）。
// 运行时动态加载 firebase client：如果项目没有安装客户端 `firebase`，
// 使用占位函数并在运行时抛出明确错误，避免 Metro 在打包阶段无法解析模块。

let auth = null;
let createUserWithEmailAndPassword = async () => { throw new Error('firebase client not installed'); };
let signInWithEmailAndPassword = async () => { throw new Error('firebase client not installed'); };

const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

try {
  // 使用 eval('require') 绕开打包时静态解析（Metro 会尝试解析顶层 import/require）
  const _require = eval('require');
  const { initializeApp } = _require('firebase/app');
  const { getAuth, createUserWithEmailAndPassword: _create, signInWithEmailAndPassword: _signIn } = _require('firebase/auth');
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  createUserWithEmailAndPassword = _create;
  signInWithEmailAndPassword = _signIn;
} catch (e) {
  // 未安装 firebase client，保持占位实现（在调用时会抛错），以防打包失败
}

export { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword };
