import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZfxAI1z7G_FXZLEt7zK11W8BUahQyop0",
  authDomain: "sales-d83d6.firebaseapp.com",
  projectId: "sales-d83d6",
  storageBucket: "sales-d83d6.firebasestorage.app",
  messagingSenderId: "181490262555",
  appId: "1:181490262555:web:218017f340b440b27b0ebe"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
