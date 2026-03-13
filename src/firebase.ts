import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBtLTZInxyKjbQCoSvqKOGDdOjhrOFfgaM",
  authDomain: "tgf-meditation.firebaseapp.com",
  projectId: "tgf-meditation",
  storageBucket: "tgf-meditation.firebasestorage.app",
  messagingSenderId: "795468174785",
  appId: "1:795468174785:web:1ce8b7365d4b08e6d58b40",
  measurementId: "G-M11YENC10E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
