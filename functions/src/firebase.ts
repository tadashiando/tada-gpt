// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import admin from "firebase-admin";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASSUREMENT_ID,
};

// Your web app's Firebase Admin configuration
const firebaseAdminConfig = {
  type: process.env.FIREBASE_ADMIN_TYPE,
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKeyId: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  clientId: process.env.FIREBASE_ADMIN_CLIENT_ID,
  authUri: process.env.FIREBASE_ADMIN_AUTH_URI,
  tokenUri: process.env.FIREBASE_ADMIN_TOKEN_URI,
  authProviderX509CertUrl:
    process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
  clientX509CertUrl: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
  universeDomain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN,
};

// Inicializando o Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseAdminConfig),
    databaseURL: "https://tadagpt-default-rtdb.firebaseio.com",
  });
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
