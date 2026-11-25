// Utilidades compartidas entre la app del barbero y la página del cliente.

const p2 = (n) => String(n).padStart(2, '0');

// Fechas en la hora del teléfono (Chile). Formato de guardado: 'AAAA-MM-DD' y 'HH:MM'.
export const hoyISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hhmm = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const deISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const sumarDias = (iso, n) => { const d = deISO(iso); d.setDate(d.getDate() + n); return hoyISO(d); };
export const lunesDe = (iso) => { const d = deISO(iso); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return hoyISO(d); };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const fechaCorta = (iso) => { const d = deISO(iso); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
export const fechaLarga = (iso) => { const d = deISO(iso); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES_L[d.getMonth()]}`; };
export const diaSemana = (iso) => DIAS[deISO(iso).getDay()];

// Para comparar nombres y teléfonos escritos de distintas formas.
export const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const tel8 = (t) => String(t || '').replace(/\D/g, '').slice(-8);
export const capitalizar = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
export const primerNombre = (n) => String(n || '').trim().split(' ')[0];

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pesos = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');

export function idAzar(n) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(n));
  return Array.from(r, (x) => abc[x % abc.length]).join('');
}

export const leerLocal = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const guardarLocal = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* modo privado */ } };

// Achica una foto del celular a JPEG. Devuelve un data URL (se guarda tal cual en Firestore).
export function comprimir(file, max, calidad) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}

// Modo de prueba local: ?emu=1 usa los emuladores de Firebase en este PC.
export const EMU = new URLSearchParams(location.search).has('emu');
export const CONFIG_EMU = { apiKey: 'demo-clave', authDomain: 'demo-bvndito.firebaseapp.com', projectId: 'demo-bvndito', appId: 'demo-app' };
