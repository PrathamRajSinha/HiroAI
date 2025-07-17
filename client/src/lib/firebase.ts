import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCOEiSfRPXCqQ-QNkrwF5ISxgHAXATqpEg",
  authDomain: "interviewai-f0881.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "interviewai-f0881",
  storageBucket: "interviewai-f0881.firebasestorage.app",
  messagingSenderId: "225121326067",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:225121326067:web:f9029777df56aafdb33886",
  measurementId: "G-BDVPSY5XN0"
};

// Initialize Firebase (prevent duplicate app error)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
export const db = getFirestore(app);



export default app;