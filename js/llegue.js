// Página "Llegué": el cliente escanea el QR del barbero, escribe su nombre y toca un botón.
// Solo puede CREAR un aviso; no ve ni toca datos del barbero (ver firestore.rules).
import { firebaseConfig } from './config.js';
import { iniciar, entrar, db, collection, addDoc, serverTimestamp } from './db.js';
import { hhmm, capitalizar, primerNombre, esc, leerLocal, guardarLocal, EMU, CONFIG_EMU } from './comun.js';

const app = document.getElementById('app');
const P = new URLSearchParams(location.search).get('p') || '';
const cfg = EMU ? CONFIG_EMU : firebaseConfig;
let yo = JSON.parse(leerLocal('bv_yo') || 'null');             // { nombre, tel } recordado en este celular
const ultimo = JSON.parse(leerLocal('bv_ultimo') || 'null');   // { p, t, hora } último aviso
let estado = 'form', error = '', enviando = false, otraPersona = false, horaAviso = '';
let listo = null; // promesa de la sesión anónima

const marca = '<div class="marca"><img src="iconos/icon-192.png" alt="Bvndito Cutsss"><span>BVNDITO CUTSSS</span></div>';
const icOk = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const icIg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor"/></svg>';

function dibujar() {
  if (!/^[A-Za-z0-9]{12,40}$/.test(P)) {
    app.innerHTML = `${marca}<h1>Este código no funciona</h1><p class="sub">Pídele al barbero que te muestre el QR de nuevo.</p>`;
    return;
  }
  if (!cfg) { app.innerHTML = `${marca}<h1>Todavía no está lista</h1><p class="sub">Avísale al barbero en persona que llegaste.</p>`; return; }
  if (estado === 'listo') {
    const n = primerNombre((yo && yo.nombre) || '');
    app.innerHTML = `${marca}<div class="ok">${icOk}</div><h1>Listo${n ? ', ' + esc(n) : ''}</h1>
      <p class="sub">El barbero ya sabe que llegaste a las ${horaAviso}. Toma asiento, ya te atiende.</p>
      <div class="acciones"><a class="ig" href="https://www.instagram.com/bvndito_cutsss/" target="_blank" rel="noopener">${icIg}Agenda tu próxima hora por Instagram</a>
      <button class="link" data-a="otra">Avisar otra vez</button></div>`;
    return;
  }
  const conocido = yo && yo.nombre && !otraPersona;
  const btns = `<div class="acciones">${error ? `<p class="error">${esc(error)}</p>` : ''}
      <button class="btn" data-a="enviar" data-hora="1" ${enviando ? 'disabled' : ''}>${enviando === 'si' ? '<span class="giro"></span>Avisando…' : 'Llegué, tengo hora'}</button>
      <button class="btn sec" data-a="enviar" data-hora="0" ${enviando ? 'disabled' : ''}>${enviando === 'no' ? '<span class="giro" style="border-top-color:#fff"></span>Avisando…' : 'Llegué sin hora'}</button>
      ${conocido ? `<button class="link" data-a="otro">No soy ${esc(primerNombre(yo.nombre))}</button>` : ''}</div>`;
  if (conocido) {
    app.innerHTML = `${marca}<h1>Hola, ${esc(primerNombre(yo.nombre))}</h1><p class="sub">Avísale al barbero que llegaste.</p>${btns}`;
    return;
  }
  app.innerHTML = `${marca}<h1>¿Llegaste?</h1><p class="sub">Avísale al barbero en un toque.</p>
    <div class="campos">
      <div class="campo"><label for="nombre">Tu nombre</label><input id="nombre" autocomplete="name" autocapitalize="words" enterkeyhint="done" maxlength="60" value="${esc(otraPersona ? '' : (yo && yo.nombre) || '')}"></div>
      <div class="campo"><label for="tel">Tu teléfono (opcional)</label><input id="tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+56 9" value="${esc(otraPersona ? '' : (yo && yo.tel) || '')}"><small>Así te reconoce la próxima vez.</small></div>
    </div>${btns}`;
}

async function enviar(conHora) {
  const conocido = yo && yo.nombre && !otraPersona;
  const nombre = conocido ? yo.nombre : capitalizar((document.getElementById('nombre') || {}).value || '');
  const tel = conocido ? (yo.tel || '') : ((document.getElementById('tel') || {}).value || '').trim();
  if (!nombre) { error = 'Escribe tu nombre para que el barbero sepa quién llegó.'; dibujar(); const i = document.getElementById('nombre'); if (i) i.focus(); return; }
  error = ''; enviando = conHora ? 'si' : 'no'; dibujar();
  try {
    await listo;
    await Promise.race([
      addDoc(collection(db, 'locales', P, 'llegadas'), { nombre: nombre.slice(0, 60), tel: tel.slice(0, 20), conHora, ts: serverTimestamp() }),
      new Promise((_, mal) => setTimeout(() => mal(new Error('tiempo')), 15000)),
    ]);
    yo = { nombre, tel };
    guardarLocal('bv_yo', JSON.stringify(yo));
    horaAviso = hhmm();
    guardarLocal('bv_ultimo', JSON.stringify({ p: P, t: Date.now(), hora: horaAviso }));
    estado = 'listo';
  } catch (e) {
    console.error(e);
    error = 'No pudimos avisar. Revisa tu señal e inténtalo de nuevo, o avísale en persona.';
  }
  enviando = false; otraPersona = false; dibujar();
}

app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'enviar' && !enviando) enviar(b.dataset.hora === '1');
  if (a === 'otro') { otraPersona = true; dibujar(); }
  if (a === 'otra') { estado = 'form'; dibujar(); }
});
app.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); } });

// Si ya avisó hace poco desde este celular, se muestra la confirmación en vez de pedir de nuevo.
if (ultimo && ultimo.p === P && Date.now() - ultimo.t < 3 * 3600 * 1000) { estado = 'listo'; horaAviso = ultimo.hora; }
if (cfg && /^[A-Za-z0-9]{12,40}$/.test(P)) { iniciar(cfg, EMU, false); listo = entrar(); listo.catch(() => {}); }
dibujar();
