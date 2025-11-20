// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBdSPXluDaF6C4UydWV-9mFWUo7iBG_saA",
  authDomain: "gigi-time-machine.firebaseapp.com",
  projectId: "gigi-time-machine",
  storageBucket: "gigi-time-machine.firebasestorage.app",
  messagingSenderId: "459534779564",
  appId: "1:459534779564:web:6a0b708fc92d49683ecb09",
  measurementId: "G-HZ5999MGQQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);