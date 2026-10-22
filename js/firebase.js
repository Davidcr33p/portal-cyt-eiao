import { firebaseConfig } from "./firebase-config.js?v=20261022140330";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);

// Las redes escolares suelen bloquear el streaming (WebChannel) que usa
// Firestore por default; con esto el SDK detecta el caso y usa long-polling.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});
export const auth = getAuth(app);
// Correos de verificación y recuperación en español.
auth.languageCode = "es";
