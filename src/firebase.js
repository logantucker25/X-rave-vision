// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAGiSW4GtHjOE4i2cyQq7cW1LnUcn0NmI8",
  authDomain: "xrave-vision.firebaseapp.com",
  projectId: "xrave-vision",
  storageBucket: "xrave-vision.firebasestorage.app",
  messagingSenderId: "448589158333",
  appId: "1:448589158333:web:cc6b0f71f40666cd39e4d4",
  measurementId: "G-J4LR4HPJDD",
  databaseURL: "https://xrave-vision-default-rtdb.firebaseio.com"
};

let app;
let database;

try {
  console.log("Initializing Firebase...");
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  console.log("Firebase Realtime Database initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { database };
export default app;