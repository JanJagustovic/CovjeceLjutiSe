import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

export const googleProvider = new GoogleAuthProvider();

export let auth     = null;
export let db       = null;
export let appCheck = null;

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

if (apiKey) {
  const app = initializeApp({
    apiKey,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  });

  auth = getAuth(app);
  db   = getFirestore(app);

  // Dev: debug token printed to console — add it in Firebase Console →
  // App Check → Apps → your app → "Manage debug tokens"
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
}