const fs = require('fs');

function getBundledFirebaseConfig() {
  const env = process.env || {};
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

  try {
    const raw = fs.readFileSync('app.json', 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.expo && parsed.expo.extra && parsed.expo.extra.firebase) return parsed.expo.extra.firebase;
  } catch (e) {
    // ignore
  }

  return null;
}

async function main() {
  const cfg = getBundledFirebaseConfig();
  if (!cfg) {
    console.error('No firebase config found in env or app.json (expo.extra.firebase).');
    process.exit(2);
  }

  console.log('Using firebase config:', { apiKey: cfg.apiKey, projectId: cfg.projectId });

  try {
    const _require = eval('require');
    const { initializeApp } = _require('firebase/app');
    const { getAuth } = _require('firebase/auth');
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    console.log('Firebase initialized. auth object present:', !!auth);
    process.exit(0);
  } catch (e) {
    console.error('Firebase init failed:', e && e.message);
    process.exit(3);
  }
}

main();
