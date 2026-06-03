// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC3ZAW8gy7j4HHVsph3nxkVOmBdxrAJuug", // Provided by user
    authDomain: "buscar-dni.firebaseapp.com",
    projectId: "buscar-dni",
    storageBucket: "buscar-dni.firebasestorage.app",
    messagingSenderId: "999888654709",
    appId: "1:999888654709:web:e7f0f829a26457034a833c",
    measurementId: "G-PRHE0RRW99"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const analytics = getAnalytics(app);

export { auth, provider, signInWithPopup, analytics };
