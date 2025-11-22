// 真实 Firebase 接入（可选）。
// 运行时动态加载 firebase client：如果项目没有安装客户端 `firebase`，
// 使用占位函数并在运行时抛出明确错误，避免 Metro 在打包阶段无法解析模块。

let auth = null;
let createUserWithEmailAndPassword = async () => { throw new Error('firebase client not installed'); };
let signInWithEmailAndPassword = async () => { throw new Error('firebase client not installed'); };

function getBundledFirebaseConfig() {
  // 1. global override (useful for tests or runtime injection)
  if (typeof global !== 'undefined' && global.__FIREBASE_CONFIG__) return global.__FIREBASE_CONFIG__;

  // 2. process.env (build-time env variables)
  try {
    const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    const apiKey = env.EXPO_PUBLIC_FIREBASE_API_KEY || env.FIREBASE_API_KEY || env.EXPO_FIREBASE_API_KEY;
    if (apiKey) {
      return {
        apiKey,
        authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || '',
        projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || '',
        storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: env.EXPO_PUBLIC_FIREBASE_APP_ID || env.FIREBASE_APP_ID || '',
      };
    }
  } catch (e) {}

  // 3. Expo Constants extra (app.json/app.config.js -> extra.firebase)
  try {
    // lazy require to avoid Metro issues in environments without expo-constants
    const Constants = eval('require')('expo-constants');
    const extra = (Constants && (Constants.expoConfig?.extra || Constants.manifest?.extra)) || {};
    if (extra.firebase) return extra.firebase;
  } catch (e) {}

  return null;
}

const firebaseConfig = getBundledFirebaseConfig();

if (!firebaseConfig) {
  // Keep placeholder behavior but give clearer instructions when attempted to use.
  const msg = 'Firebase config missing. Set EXPO_PUBLIC_FIREBASE_API_KEY / EXPO_PUBLIC_FIREBASE_PROJECT_ID (or provide expo extra.firebase) before building the app.';
  createUserWithEmailAndPassword = async () => { throw new Error(msg); };
  signInWithEmailAndPassword = async () => { throw new Error(msg); };
} else {
  try {
    const _require = eval('require');
    const { initializeApp } = _require('firebase/app');
    const { getAuth, createUserWithEmailAndPassword: _create, signInWithEmailAndPassword: _signIn } = _require('firebase/auth');
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    createUserWithEmailAndPassword = _create;
    signInWithEmailAndPassword = _signIn;
  } catch (e) {
    // firebase client not installed or failed to initialize
    const msg = 'Firebase client not installed or failed to initialize: ' + (e && e.message);
    createUserWithEmailAndPassword = async () => { throw new Error(msg); };
    signInWithEmailAndPassword = async () => { throw new Error(msg); };
  }
}

// Export using CommonJS to avoid conditional/export-in-block issues during bundling
module.exports = { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword };
