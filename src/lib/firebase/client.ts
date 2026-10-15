import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const configured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
export function firebaseApp() {
  if (!configured)
    throw new Error(
      "Firebase Web App configuration is missing. Fill .env.local from .env.example.",
    );
  if (getApps().length) return getApp();
  const app = initializeApp(config);
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true"
  ) {
    connectAuthEmulator(getAuth(app), "http://127.0.0.1:9098", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8088);
    connectStorageEmulator(getStorage(app), "127.0.0.1", 9198);
  }
  const key = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (typeof window !== "undefined" && key)
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(key),
      isTokenAutoRefreshEnabled: true,
    });
  return app;
}
export const auth = () => getAuth(firebaseApp());
export const db = () => getFirestore(firebaseApp());
export const storage = () => getStorage(firebaseApp());
