// Capa de datos: Firebase Auth anónimo + Firestore. Igual que el Cuaderno de Juan.
//   /barberias/{codigo}/...        datos del barbero (solo entra quien tiene el código largo de su link)
//   /locales/{publico}/llegadas    avisos "llegué" que mandan los clientes desde el QR (no pueden leer nada)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, collection, onSnapshot, setDoc, deleteDoc, query, where, getDocs, writeBatch, arrayUnion, serverTimestamp, addDoc, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export { doc, collection, onSnapshot, setDoc, deleteDoc, query, where, getDocs, writeBatch, arrayUnion, serverTimestamp, addDoc, runTransaction };
export let db = null;
let auth = null;

// `guardarEnCelular`: la app del barbero guarda todo en el teléfono para abrir sin señal. La página del cliente no.
export function iniciar(config, emulador, guardarEnCelular) {
  const app = initializeApp(config);
  auth = getAuth(app);
  const red = emulador ? { experimentalForceLongPolling: true } : {};
  if (guardarEnCelular) {
    try { db = initializeFirestore(app, Object.assign({ localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, red)); }
    catch (e) { db = initializeFirestore(app, red); }
  } else db = initializeFirestore(app, red);
  if (emulador) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

// Resuelve con el uid de una sesión anónima (reutiliza la guardada).
export function entrar() {
  return new Promise((resolve, reject) => {
    let listo = false;
    const fin = onAuthStateChanged(auth, (u) => {
      if (u) { if (!listo) { listo = true; fin(); resolve(u.uid); } return; }
      signInAnonymously(auth).catch((e) => { if (!listo) { listo = true; fin(); reject(e); } });
    }, (e) => { if (!listo) { listo = true; reject(e); } });
  });
}
