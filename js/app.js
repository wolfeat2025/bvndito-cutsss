// Bvndito Cutsss · app del barbero (semana de prueba).
// Todo se dibuja como texto HTML desde el estado E y se vuelve a dibujar cuando cambian los datos.
import { firebaseConfig } from './config.js';
import { iniciar, entrar, db, doc, collection, onSnapshot, setDoc, query, where, getDocs, writeBatch, arrayUnion, runTransaction } from './db.js';
import { hoyISO, hhmm, sumarDias, lunesDe, deISO, fechaCorta, fechaLarga, normal, tel8, capitalizar, primerNombre, esc, pesos, idAzar, leerLocal, guardarLocal, comprimir, EMU, CONFIG_EMU } from './comun.js';

/* ---------- Negocio ---------- */
const SERV = { basico: { n: 'Básico', p: 10000 }, completo: { n: 'Completo', p: 15000 } };
const EXTRA = { diseno: { n: 'Diseño', p: 2000 }, cejas: { n: 'Cejas', p: 2000 } };
const PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };
const MULTA = 4000;
const RESERVA_MIN = 60;
const MIN_VALIDO = 5;
const codigoOk = (c) => typeof c === 'string' && /^[A-Za-z0-9]{24,64}$/.test(c);

/* ---------- Estado ---------- */
const E = {
  fase: 'cargando', b: null, p: null, uid: null, offline: false,
  clientes: {}, citas: [], visitas: [], llegadas: [], cargado: {}, procesados: new Set(), fotos: {},
  dia: hoyISO(), screen: 'hoy', from: 'hoy', ficha: null, sheet: null, viewer: null, qr: false,
  q: '', per: 'semana', editNota: false, cmp: {}, avisarIG: true, cobro: null, nv: null, citaSel: null, form: {}, quitar: false, toast: null,
};
const root = document.getElementById('app');
const META = { includeMetadataChanges: true };

/* ---------- Utilidades de la app ---------- */
const R = (col) => collection(db, 'barberias', E.b, col);
const ref = (col, id) => doc(db, 'barberias', E.b, col, id);
const nuevoId = (col) => doc(R(col)).id;
const fallo = (e) => { console.error('Firestore', e); avisa('No se pudo guardar', 'Revisa la señal e inténtalo de nuevo', true); };
// Guarda y además aplica el cambio en pantalla al tiro (la copia de Firestore llega un instante después).
function cambiar(col, id, datos) {
  if (col === 'citas') { const c = E.citas.find((x) => x.id === id); if (c) Object.assign(c, datos); }
  if (col === 'clientes' && E.clientes[id]) Object.assign(E.clientes[id], datos);
  return setDoc(ref(col, id), datos, { merge: true }).catch(fallo);
}
const cli = (id) => E.clientes[id] || { id, n: 'Cliente', corte: [], vis: 0 };
const porHora = (a, b) => (a.h || '').localeCompare(b.h || '');
const citasDe = (iso) => E.citas.filter((c) => c.fecha === iso).sort(porHora);
const enCurso = () => E.citas.find((c) => c.est === 'encurso');
const elapsed = (c) => Math.floor(((c && c.run && c.run.acc) || 0) + (c && c.run && c.run.desde ? (Date.now() - c.run.desde) / 1000 : 0));
const corriendo = (c) => !!(c && c.run && c.run.desde);
const fmt = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60, p = (v) => String(v).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`; };
const prom = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
function actual() {
  const hoy = citasDe(hoyISO());
  return hoy.find((c) => c.est === 'encurso')
    || hoy.filter((c) => c.est === 'llego').sort((a, b) => (a.llego || a.h).localeCompare(b.llego || b.h))[0]
    || hoy.find((c) => c.est === 'pendiente');
}
function caja(lista) {
  const r = { total: 0, efectivo: 0, transferencia: 0, tarjeta: 0 };
  lista.filter((c) => c.est === 'listo').forEach((c) => { r.total += c.total || 0; r[c.pago] = (r[c.pago] || 0) + (c.total || 0); });
  return r;
}
const buscarCliente = (nombre, tel) => {
  const t = tel8(tel), n = normal(nombre), lista = Object.values(E.clientes);
  return (t.length === 8 && lista.find((c) => tel8(c.tel) === t)) || lista.find((c) => normal(c.n) === n) || null;
};

let toastT;
function avisa(a, b, mal) { E.toast = [a, b, !!mal]; clearTimeout(toastT); toastT = setTimeout(() => { E.toast = null; render(); }, 3200); render(); }

/* ---------- Íconos ---------- */
const S = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ic = {
  hoy: S('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  cli: S('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>'),
  num: S('<path d="M5 20V12M12 20V5M19 20v-5"/>'),
  qr: S('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>'),
  cam: S('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  lupa: S('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  up: S('<path d="M6 15l6-6 6 6"/>'), down: S('<path d="M6 9l6 6 6-6"/>'), mas: S('<path d="M12 5v14M5 12h14"/>'),
  pausa: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  rayo: S('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>'),
  reloj: S('<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>'),
  moneda: S('<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.4-.9-1.4-1.4-2.5-1.4-1.5 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.1 0 1.1-1 1.9-2.5 1.9-1.2 0-2.2-.5-2.6-1.5M12 6.5v1.3M12 16.2v1.3"/>'),
  tijera: S('<circle cx="6" cy="7" r="2.6"/><circle cx="6" cy="17" r="2.6"/><path d="M8.2 8.4L20 17.5M8.2 15.6L20 6.5"/>'),
  ig: S('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor"/>'),
};
const mono = '<span class="mono"><img src="iconos/icon-192.png" alt="Bvndito Cutsss"></span>';

/* ---------- Piezas ---------- */
function thumb(k, conLabel = true) {
  const c = cli(k);
  if (!c.thumb) return `<span class="thumb none">Sin foto aún</span>`;
  return `<button class="thumb" data-a="ver" data-k="${k}" aria-label="Ver fotos de ${esc(c.n)}"><img src="${c.thumb}" alt="">${conLabel && c.ult ? `<span class="lbl">${fechaCorta(c.ult)}</span>` : ''}</button>`;
}
function spec(c) {
  const corte = (c.corte || []).filter((x) => x && x.k && x.v);
  if (!corte.length) return `<div class="spec vacio">Aún no hay datos de su corte. Se agregan en su ficha, en "Editar".</div>`;
  return `<div class="spec">${corte.map((x) => `<div class="r"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></div>`).join('')}</div>`;
}
function estadoFila(c) {
  if (c.est === 'llego') return `<span class="dot">● Llegó ${c.llego || ''}</span>`;
  if (c.est === 'encurso') return 'En la silla';
  if (c.est === 'listo') return `${c.min || '—'} min · ${pesos(c.total)}`;
  if (c.est === 'novino') return 'No vino';
  return SERV[c.serv] ? SERV[c.serv].n : '';
}
const fila = (c) => `<button class="row ${c.est === 'listo' ? 'done' : ''} ${c.est === 'novino' ? 'no' : ''}" data-a="cita" data-id="${c.id}"><span>${c.h}</span><span class="ell">${esc(cli(c.cl).n)}</span><span>${estadoFila(c)}</span></button>`;

/* ---------- Pantalla Hoy ---------- */
function vistaHoy() {
  const hoy = hoyISO(), esHoy = E.dia === hoy, lista = citasDe(E.dia), cj = caja(lista);
  const etiqueta = esHoy ? fechaLarga(E.dia) : (E.dia === sumarDias(hoy, 1) ? 'Mañana · ' : E.dia === sumarDias(hoy, -1) ? 'Ayer · ' : '') + fechaLarga(E.dia);
  let html = `<div class="hrow">${mono}<div class="grow dia"><button class="ar" data-a="dia" data-v="-1" aria-label="Día anterior">‹</button>
      <button class="lbl ${esHoy ? '' : 'otro'}" data-a="dia" data-v="0">${etiqueta}</button><button class="ar" data-a="dia" data-v="1" aria-label="Día siguiente">›</button></div>
      <button class="qrbtn" data-a="qr">${ic.qr}QR</button></div>`;
  if (E.offline) html += `<span class="offline">● Sin señal: se guarda en el teléfono y se sube al volver la señal</span>`;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !leerLocal('bv_inst')) {
    html += `<div class="aviso"><div><b>Déjala como app:</b> toca el botón Compartir de Safari (el cuadrado con la flecha) y elige "Agregar a inicio".</div><div class="rowbtns"><span></span><button data-a="inst-ok">Listo</button></div></div>`;
  }
  const listos = lista.filter((c) => c.est === 'listo').length, no = lista.filter((c) => c.est === 'novino').length;
  const quedan = lista.filter((c) => ['pendiente', 'llego', 'encurso'].includes(c.est)).length;
  html += `<div class="money"><span class="cap">${esHoy ? 'Caja de hoy' : 'Caja del día'}</span><span class="amt"><sup>$</sup>${cj.total.toLocaleString('es-CL')}</span>
    <span class="sub">Efectivo ${cj.efectivo.toLocaleString('es-CL')} · Transferencia ${cj.transferencia.toLocaleString('es-CL')}${cj.tarjeta ? ' · Tarjeta ' + cj.tarjeta.toLocaleString('es-CL') : ''}</span></div>`;
  if (lista.length) {
    html += `<div class="segs" style="grid-template-columns:repeat(${lista.length},1fr)">${lista.map((c) => `<i class="${c.est === 'listo' ? 'ok' : c.est === 'novino' ? 'no' : c.est === 'encurso' ? 'now' : c.est === 'llego' ? 'llego' : ''}"></i>`).join('')}</div>
      <div class="segl"><span>${listos} listo${listos === 1 ? '' : 's'}${no ? ` · ${no} no vino` : ''}</span><span>${quedan} por delante</span></div>`;
  }
  if (!esHoy) {
    html += lista.length ? `<div class="list"><span class="cap">Horas del día</span>${lista.map(fila).join('')}</div>`
      : `<div class="vacio-box"><b>Sin horas este día</b>Toca + para agregar una.</div>`;
    return html;
  }
  const cur = actual();
  if (!lista.length) return html + `<div class="vacio-box"><b>Todavía no hay nadie hoy</b>Cuando un cliente escanee tu QR aparece aquí solo. Las horas agendadas se agregan con +.</div>`;
  html += tarjeta(cur);
  const prox = lista.filter((c) => c !== cur && (c.est === 'pendiente' || c.est === 'llego'));
  if (prox.length) {
    let rows = '', hPrev = cur ? parseInt(cur.h, 10) : null;
    prox.forEach((c) => { const h = parseInt(c.h, 10);
      if (hPrev != null) for (let x = hPrev + 1; x < h; x++) rows += `<div class="row free"><span>${String(x).padStart(2, '0')}:00</span><span>Libre</span><span></span></div>`;
      rows += fila(c); hPrev = h; });
    html += `<div class="list"><span class="cap">Después</span>${rows}</div>`;
  }
  const hechos = lista.filter((c) => c.est === 'listo' || c.est === 'novino');
  if (hechos.length) html += `<div class="list"><span class="cap">Ya pasaron</span>${hechos.map(fila).join('')}</div>`;
  return html;
}

function tarjeta(cur) {
  if (!cur) return `<div class="metal next"><span class="cap gold">Día terminado</span><div class="nm">No quedan clientes</div><div class="sub">Revisa cómo te fue en "Mis números".</div></div>`;
  const c = cli(cur.cl), s = SERV[cur.serv] || SERV.basico;
  if (cur.est === 'encurso') {
    const run = corriendo(cur);
    return `<div class="metal hi next"><div class="minitimer"><span class="cap ${run ? 'gold rec' : 'pau'}">${run ? 'En la silla' : 'En pausa'}</span><span class="t" data-tm="${cur.id}">${fmt(elapsed(cur))}</span></div>
      <div><div class="nm">${esc(c.n)}</div><div class="sub">${s.n} · ${pesos(s.p)}</div></div>
      <button class="btn" data-a="foco">Volver al corte</button></div>`;
  }
  const compacta = E.cmp[cur.id] ?? (cur.est !== 'llego');
  const cuando = cur.est === 'llego' ? `Llegó ${cur.llego}` : `Su hora ${cur.h}`;
  if (compacta) {
    return `<div class="metal ${cur.est === 'llego' ? 'hi' : ''} next cmp">
      ${c.thumb ? `<span class="thumb"><img src="${c.thumb}" alt=""></span>` : '<span class="thumb none">—</span>'}
      <button data-a="compactar" data-id="${cur.id}" style="min-width:0" aria-label="Abrir tarjeta de ${esc(c.n)}"><div class="nm ell">${esc(c.n)}</div><div class="sub ell opn">${cuando} · ${s.n}${ic.down}</div></button>
      <button class="pill" data-a="empezar" data-id="${cur.id}">Empezar</button></div>`;
  }
  const cap = cur.est === 'llego' ? `<span class="cap gold">Llegó ${cur.llego}${cur.sinHora ? ' · sin hora' : ` · su hora ${cur.h}`}</span>` : `<span class="cap">Su hora ${cur.h} · aún no llega</span>`;
  const chips = [`<span class="chip">${s.n} · ${pesos(s.p)}</span>`, c.vis ? `<span class="chip">${c.vis + 1}ª visita</span>` : `<span class="chip gold">Primera vez</span>`,
    cur.sinHora && cur.conHora ? '<span class="chip gold">Dice que tenía hora</span>' : '', c.debe ? `<span class="chip red">Debe ${pesos(c.debe)}</span>` : ''].join('');
  return `<div class="metal ${cur.est === 'llego' ? 'hi' : ''} next">
    <div class="head">${cap}<button class="chev" data-a="compactar" data-id="${cur.id}" aria-label="Achicar tarjeta">${ic.up}</button></div>
    <div class="who">${thumb(cur.cl)}<div><button class="nm" data-a="ficha" data-k="${cur.cl}" style="text-align:left">${esc(c.n)}</button><div class="chips">${chips}</div></div></div>
    ${spec(c)}
    <button class="btn" data-a="empezar" data-id="${cur.id}">Empezar corte</button>
    <button class="link" data-a="novino" data-id="${cur.id}">No vino</button></div>`;
}

/* ---------- Modo foco ---------- */
function vistaFoco() {
  const cur = enCurso();
  if (!cur) { E.screen = 'hoy'; return vistaHoy(); }
  const c = cli(cur.cl), s = SERV[cur.serv] || SERV.basico, e = elapsed(cur), run = corriendo(cur);
  const C = 2 * Math.PI * 92, pct = Math.min(1, e / (RESERVA_MIN * 60)), over = e > RESERVA_MIN * 60;
  const nx = citasDe(cur.fecha).find((x) => x.id !== cur.id && (x.est === 'llego' || x.est === 'pendiente') && x.h >= cur.h) || citasDe(cur.fecha).find((x) => x.est === 'llego');
  return `<div class="foco-top"><button class="back" data-a="tab" data-v="hoy">‹ Hoy</button><span class="sub">${cur.sinHora ? 'Llegó ' + cur.llego : 'Su hora ' + cur.h}</span></div>
    <div class="ring"><svg viewBox="0 0 208 208"><defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc98"/><stop offset="1" stop-color="#b8862f"/></linearGradient></defs>
      <circle cx="104" cy="104" r="92" fill="none" stroke="#1b1b1b" stroke-width="7"/>
      <circle data-ring cx="104" cy="104" r="92" fill="none" stroke="${over ? '#ff5a4f' : run ? 'url(#gr)' : '#f0b768'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"/></svg>
      <div class="in"><span class="cap ${run ? 'rec' : 'pau'}">${run ? 'Corriendo' : 'En pausa'}</span><span class="t" data-tm="${cur.id}">${fmt(e)}</span><small data-over class="${over ? 'over' : ''}">${over ? 'pasó la hora reservada' : `de ${RESERVA_MIN} min reservados`}</small></div></div>
    <div class="ctrl">${run ? `<button data-a="pausa">${ic.pausa}Pausar</button>` : `<button class="play" data-a="play">${ic.play}Seguir</button>`}</div>
    <div class="foco-who"><button class="nm" data-a="ficha" data-k="${cur.cl}">${esc(c.n)}</button><div class="sub">${s.n} · ${pesos(s.p)}${c.vis ? ` · ${c.vis + 1}ª visita` : ' · primera vez'}</div></div>
    <div class="foco-corte">${thumb(cur.cl)}${spec(c)}</div>
    <button class="btn" data-a="cobrar">Terminar y cobrar</button>
    ${nx ? `<div class="metal despues"><div><span class="sub">Después</span>${esc(cli(nx.cl).n)}</div><b>${nx.est === 'llego' ? 'Llegó' : nx.h}</b></div>` : ''}`;
}

/* ---------- Clientes y ficha ---------- */
function vistaClientes() {
  return `<div class="rowbtns"><div class="ttl">Clientes</div><button class="mini-link" data-a="nuevo-cliente">+ Nuevo</button></div>
    <label class="search">${ic.lupa}<input data-in="buscar" placeholder="Buscar por nombre" value="${esc(E.q)}" aria-label="Buscar cliente" autocomplete="off"></label>
    <div data-lista>${listaClientes()}</div>`;
}
function listaClientes() {
  const q = normal(E.q);
  const ks = Object.values(E.clientes).filter((c) => normal(c.n).includes(q)).sort((a, b) => a.n.localeCompare(b.n));
  if (!ks.length) return `<p class="centro">${Object.keys(E.clientes).length ? 'Nadie con ese nombre.' : 'Aún no hay clientes. Aparecen solos cuando escanean el QR o cuando agregas una hora.'}</p>`;
  return ks.map((c) => `<button class="cli" data-a="ficha" data-k="${c.id}">${c.thumb ? `<span class="thumb"><img src="${c.thumb}" alt=""></span>` : '<span class="thumb none">—</span>'}
    <span><b>${esc(c.n)}</b><span class="sub">${c.vis ? `${c.vis} visita${c.vis === 1 ? '' : 's'} · última ${fechaCorta(c.ult)}` : 'Primera vez'}${c.debe ? ' · debe ' + pesos(c.debe) : ''}</span></span><span class="ch">›</span></button>`).join('');
}
function vistaFicha() {
  const k = E.ficha, c = E.clientes[k];
  if (!c) { E.screen = E.from; return vista(); }
  const fs = Array.isArray(E.fotos[k]) ? E.fotos[k] : [];
  const f0 = fs[0];
  const mins = E.visitas.filter((v) => v.cl === k && v.min >= MIN_VALIDO).map((v) => v.min);
  const hero = (f0 || c.thumb) ? `<button class="hero" data-a="ver" data-k="${k}"><img src="${f0 ? f0.data : c.thumb}" alt="Último corte de ${esc(c.n)}"><div class="over"><div class="nm">${esc(c.n)}</div><div class="sub">Último corte · ${fechaCorta(f0 ? f0.fecha : c.ult)}</div></div></button>`
    : `<div class="hero none"><div><div class="nm" style="color:var(--ink)">${esc(c.n)}</div>Aún no hay fotos. Sácale una al cobrar su corte.</div></div>`;
  const thumbs = fs.slice(1).map((x, i) => `<button class="thumb" data-a="ver" data-k="${k}" data-i="${i + 1}"><img src="${x.data}" alt=""><span class="lbl">${fechaCorta(x.fecha)}</span></button>`).join('');
  const f = E.form;
  const editor = !E.editNota ? '' : `<div class="edit">
      <div class="r"><input value="Nombre" disabled aria-hidden="true" tabindex="-1"><input data-in="f-n" value="${esc(f.n)}" aria-label="Nombre"></div>
      <div class="r"><input value="Teléfono" disabled aria-hidden="true" tabindex="-1"><input data-in="f-tel" value="${esc(f.tel)}" inputmode="tel" aria-label="Teléfono"></div>
      ${f.corte.map((x, i) => `<div class="r"><input data-in="f-k" data-i="${i}" value="${esc(x.k)}" placeholder="Ej: Lados" aria-label="Parte"><input data-in="f-v" data-i="${i}" value="${esc(x.v)}" placeholder="Ej: Fade medio" aria-label="Cómo"></div>`).join('')}
      <div class="rowbtns"><button class="link" style="width:auto" data-a="cancelar-nota">Cancelar</button><button class="mini-link" data-a="guardar-nota">Guardar</button></div></div>`;
  return `<div class="rowbtns"><button class="back" data-a="back">‹ ${E.from === 'clientes' ? 'Clientes' : 'Volver'}</button><span class="sub">${esc(c.tel || '')}</span></div>
    ${hero}
    <div class="fld"><div class="rowbtns"><span class="cap gold">Su corte</span>${E.editNota ? '' : `<button class="mini-link" data-a="editar">Editar</button>`}</div>${E.editNota ? editor : spec(c)}</div>
    <div class="thumbs">${thumbs}<label class="addfoto" aria-label="Agregar foto"><input type="file" accept="image/*" capture="environment" class="vis-hidden" data-file="ficha">+</label></div>
    <div class="stats"><div class="stat"><b>${c.vis || 0}</b><span>visitas</span></div><div class="stat"><b>${mins.length ? prom(mins) + "'" : '—'}</b><span>min promedio</span></div>
      <div class="stat"><b>${c.debe ? pesos(c.debe) : '$0'}</b><span>debe</span></div></div>
    ${c.debe ? `<button class="link" data-a="perdonar">Ya pagó lo que debía: dejar en $0</button>` : ''}
    <button class="btn dark" data-a="nueva" data-k="${k}">Agendar una hora</button>`;
}

/* ---------- Mis números ---------- */
function vistaNumeros() {
  const hoy = hoyISO(), sem = E.per === 'semana';
  const desde = sem ? lunesDe(hoy) : hoy.slice(0, 8) + '01';
  const antes = sem ? sumarDias(desde, -7) : mesAntes(desde);
  // Los cortes de menos de 5 minutos no cuentan para los tiempos: casi siempre es que se olvidó iniciar el reloj.
  const todos = E.visitas.filter((v) => v.fecha >= desde);
  const vs = todos.filter((v) => v.min >= MIN_VALIDO);
  const prev = E.visitas.filter((v) => v.fecha >= antes && v.fecha < desde && v.min >= MIN_VALIDO);
  let html = `<div class="ttl">Mis números</div>
    <div class="segc" style="grid-template-columns:1fr 1fr"><button class="${sem ? 'on' : ''}" data-a="per" data-v="semana">Esta semana</button><button class="${sem ? '' : 'on'}" data-a="per" data-v="mes">Este mes</button></div>`;
  if (!todos.length) return html + `<div class="vacio-box"><b>Todavía no hay cortes ${sem ? 'esta semana' : 'este mes'}</b>Cuando termines y cobres un corte, aquí vas a ver cuánto te demoras y cuánto ganas por hora.</div>`;
  if (!vs.length) return html + `<div class="duo"><div class="card-s plata"><span class="bdg">${ic.moneda}</span><b>${pesos(todos.reduce((a, v) => a + (v.total || 0), 0))}</b><span>cobrado ${sem ? 'esta semana' : 'este mes'}</span></div>
      <div class="card-s"><span class="bdg">${ic.tijera}</span><b>${todos.length}</b><span>cortes ${sem ? 'esta semana' : 'este mes'}</span></div></div>
    <div class="vacio-box"><b>Aún no hay tiempos</b>Los cortes de menos de ${MIN_VALIDO} minutos no cuentan para el promedio. Toca "Empezar corte" cuando el cliente se siente.</div>`;
  const p = prom(vs.map((v) => v.min));
  let delta = '';
  if (prev.length) { const d = prom(prev.map((v) => v.min)) - p; const cuando = sem ? 'la semana pasada' : 'el mes pasado';
    delta = d > 0 ? `<span class="delta">↓ ${d} min más rápido que ${cuando}</span>` : d < 0 ? `<span class="delta peor">↑ ${-d} min más lento que ${cuando}</span>` : `<span class="delta">Igual que ${cuando}</span>`; }
  const porServ = (k) => prom(vs.filter((v) => v.serv === k).map((v) => v.min));
  const tope = Math.max(60, porServ('basico'), porServ('completo'));
  const totalMin = vs.reduce((a, v) => a + v.min, 0), totalPlata = vs.reduce((a, v) => a + (v.total || 0), 0);
  const rap = vs.reduce((a, v) => (v.min < a.min ? v : a)), len = vs.reduce((a, v) => (v.min > a.min ? v : a));
  let lab, col;
  if (sem) { lab = ['L', 'M', 'M', 'J', 'V', 'S']; col = lab.map((_, i) => todos.filter((v) => v.fecha === sumarDias(desde, i)).length); }
  else { const n = Math.ceil(deISO(hoy).getDate() / 7); lab = Array.from({ length: n }, (_, i) => `Sem ${i + 1}`); col = lab.map((_, i) => todos.filter((v) => Math.floor((deISO(v.fecha).getDate() - 1) / 7) === i).length); }
  const mx = Math.max(1, ...col);
  const hechos = citasDe(hoy).filter((c) => c.est === 'listo');
  html += `<div class="metal hi kpi"><span class="cap gold">Tiempo promedio por corte</span><div class="big">${p}<small>min</small></div>${delta}</div>
    <div class="bars">${['basico', 'completo'].map((k) => { const m = porServ(k); return `<div class="bar"><div class="l"><span>${SERV[k].n}</span><b>${m ? m + ' min' : '—'}</b></div><div class="tr"><i style="width:${m / tope * 100}%"></i></div></div>`; }).join('')}</div>
    <div class="duo">
      <div class="card-s plata"><span class="bdg">${ic.moneda}</span><b>${pesos(totalMin ? totalPlata / totalMin * 60 : 0)}</b><span>ganas por hora cortando</span></div>
      <div class="card-s"><span class="bdg">${ic.tijera}</span><b>${todos.length}</b><span>cortes ${sem ? 'esta semana' : 'este mes'}</span></div>
      <div class="card-s rapido"><span class="bdg">${ic.rayo}</span><b>${rap.min} min</b><span class="ell">el más rápido · ${esc(primerNombre(rap.n))}</span></div>
      <div class="card-s lento"><span class="bdg">${ic.reloj}</span><b>${len.min} min</b><span class="ell">el más lento · ${esc(primerNombre(len.n))}</span></div></div>
    <div><span class="cap">${sem ? 'Cortes por día' : 'Cortes por semana'}</span>
      <div class="cols" style="grid-template-columns:repeat(${col.length},1fr)">${col.map((v, i) => `<div class="${v === mx && v ? 'top' : ''}"><b>${v}</b><i style="height:${v / mx * 66}px"></i><span>${lab[i]}</span></div>`).join('')}</div></div>
    <div class="list today"><span class="cap">Hoy</span>${hechos.map((c) => `<div class="row"><span style="color:var(--ink)">${esc(cli(c.cl).n)} <span class="sub">· ${(SERV[c.serv] || SERV.basico).n}</span></span><span>${c.min} min</span></div>`).join('') || '<p class="centro">Todavía no terminas ningún corte hoy.</p>'}</div>`;
  return html;
}
const mesAntes = (iso) => { const d = deISO(iso); d.setDate(1); d.setMonth(d.getMonth() - 1); return hoyISO(d); };

/* ---------- Hojas ---------- */
function hoja() {
  if (!E.sheet) return '';
  let body = '';
  if (E.sheet === 'cobro') {
    const cur = enCurso(); if (!cur) { E.sheet = null; return ''; }
    const c = cli(cur.cl), k = E.cobro;
    const total = SERV[k.serv].p + k.extras.reduce((a, x) => a + EXTRA[x].p, 0) + (k.debe ? (c.debe || 0) : 0);
    body = `<div class="sh-head"><h3>Cobrar a ${esc(primerNombre(c.n))}</h3><button class="x" data-a="cerrar" aria-label="Cerrar">✕</button></div>
      <div class="clock"><span class="pau">${ic.pausa}Reloj detenido · tiempo del corte</span><span class="t">${fmt(elapsed(cur))}</span></div>
      <div class="fld"><span class="cap">Servicio</span><div class="segc" style="grid-template-columns:1fr 1fr">${Object.entries(SERV).map(([key, s]) => `<button class="${k.serv === key ? 'on' : ''}" data-a="serv" data-v="${key}">${s.n}<small>${pesos(s.p)}</small></button>`).join('')}</div></div>
      <div class="fld"><span class="cap">Extras</span><div class="tog">${Object.entries(EXTRA).map(([key, x]) => `<button class="${k.extras.includes(key) ? 'on' : ''}" data-a="extra" data-v="${key}">+ ${x.n} ${pesos(x.p)}</button>`).join('')}
        ${c.debe ? `<button class="${k.debe ? 'on' : ''}" data-a="debe">+ Lo que debía ${pesos(c.debe)}</button>` : ''}</div></div>
      <div class="fld"><span class="cap">Pago</span><div class="segc" style="grid-template-columns:repeat(3,1fr)">${Object.entries(PAGO).map(([key, n]) => `<button class="${k.pago === key ? 'on' : ''}" data-a="pago" data-v="${key}">${n}</button>`).join('')}</div></div>
      <label class="fotobox ${k.foto ? 'ok' : ''}"><input type="file" accept="image/*" capture="environment" class="vis-hidden" data-file="cobro">
        ${k.foto ? `<span class="thumb"><img src="${k.thumb}" alt=""></span><span><b>Foto lista</b><span>Toca para cambiarla</span></span>` : `<span class="camico">${ic.cam}</span><span><b>${k.subiendo ? 'Preparando foto…' : 'Sacar foto del corte'}</b><span>Para recordarlo la próxima vez</span></span>`}</label>
      <div class="total"><span class="sub">Total</span><b>${pesos(total)}</b></div>
      <button class="btn" data-a="confirmar" ${k.subiendo ? 'disabled' : ''}>Confirmar ${pesos(total)}</button>
      <button class="link" data-a="cerrar">Falta retocar algo</button>`;
  }
  if (E.sheet === 'novino') {
    const cita = E.citas.find((x) => x.id === E.nv); if (!cita) { E.sheet = null; return ''; }
    const c = cli(cita.cl);
    body = `<div class="sh-head"><h3>¿${esc(primerNombre(c.n))} no vino?</h3><button class="x" data-a="cerrar" aria-label="Cerrar">✕</button></div>
      <p class="sub" style="margin:0;font-size:14.5px">Se marca en rojo en la barra del día y se le anotan ${pesos(MULTA)} para su próximo corte.</p>
      <button class="sw-row" data-a="ig" role="switch" aria-checked="${E.avisarIG}"><b>${ic.ig}Avisarle por Instagram</b><span class="sw ${E.avisarIG ? 'on' : ''}"></span></button>
      ${E.avisarIG ? `<div class="dm"><div class="bub">${esc(mensajeNoVino(c, cita))}</div><small>En esta prueba el mensaje se copia y tú lo pegas en su chat de Instagram.</small></div>` : ''}
      <button class="btn red" data-a="confirmar-nv">Sí, no vino</button><button class="link" data-a="cerrar">Cancelar</button>`;
  }
  if (E.sheet === 'nueva') {
    const f = E.form, hoy = hoyISO();
    body = `<div class="sh-head"><h3>Agregar hora</h3><button class="x" data-a="cerrar" aria-label="Cerrar">✕</button></div>
      <div class="fld"><span class="cap">Cliente</span><input class="inp" data-in="n-nombre" value="${esc(f.nombre)}" placeholder="Nombre" autocomplete="off" autocapitalize="words" aria-label="Nombre del cliente">
        <div class="sugs" data-sugs>${sugerencias()}</div>
        <input class="inp" data-in="n-tel" value="${esc(f.tel)}" placeholder="Teléfono (opcional)" inputmode="tel" aria-label="Teléfono"></div>
      <div class="fld"><span class="cap">Día</span><div class="segc" style="grid-template-columns:repeat(3,1fr)">
        <button class="${f.fecha === hoy ? 'on' : ''}" data-a="n-dia" data-v="${hoy}">Hoy</button><button class="${f.fecha === sumarDias(hoy, 1) ? 'on' : ''}" data-a="n-dia" data-v="${sumarDias(hoy, 1)}">Mañana</button>
        <button class="${f.fecha > sumarDias(hoy, 1) || f.fecha < hoy ? 'on' : ''}" data-a="n-otro">Otro día</button></div>
        ${f.otro ? `<input class="inp" type="date" data-in="n-fecha" value="${f.fecha}" min="${hoy}" aria-label="Fecha">` : ''}</div>
      <div class="fld"><span class="cap">Hora</span><input class="inp" type="time" step="900" data-in="n-hora" value="${f.hora}" aria-label="Hora"></div>
      <div class="fld"><span class="cap">Servicio</span><div class="segc" style="grid-template-columns:1fr 1fr">${Object.entries(SERV).map(([key, s]) => `<button class="${f.serv === key ? 'on' : ''}" data-a="n-serv" data-v="${key}">${s.n}<small>${pesos(s.p)}</small></button>`).join('')}</div></div>
      <button class="btn" data-a="guardar-nueva">Agregar</button>`;
  }
  if (E.sheet === 'cliente') {
    const f = E.form;
    body = `<div class="sh-head"><h3>Nuevo cliente</h3><button class="x" data-a="cerrar" aria-label="Cerrar">✕</button></div>
      <input class="inp" data-in="c-nombre" value="${esc(f.nombre)}" placeholder="Nombre" autocapitalize="words" autocomplete="off" aria-label="Nombre">
      <input class="inp" data-in="c-tel" value="${esc(f.tel)}" placeholder="Teléfono (opcional)" inputmode="tel" aria-label="Teléfono">
      <button class="btn" data-a="guardar-cliente">Guardar</button>`;
  }
  if (E.sheet === 'cita') {
    const cita = E.citas.find((x) => x.id === E.citaSel); if (!cita) { E.sheet = null; return ''; }
    const c = cli(cita.cl), s = SERV[cita.serv] || SERV.basico, esHoy = cita.fecha === hoyISO(), abierta = cita.est === 'pendiente' || cita.est === 'llego';
    const f = E.form;
    body = `<div class="sh-head"><div><h3>${esc(c.n)}</h3><div class="sub">${fechaLarga(cita.fecha)} · ${cita.h} · ${s.n}</div></div><button class="x" data-a="cerrar" aria-label="Cerrar">✕</button></div>
      ${cita.est === 'listo' ? `<div class="clock"><span>${cita.min} min · ${PAGO[cita.pago] || ''}</span><b style="color:var(--ink);font-size:20px">${pesos(cita.total)}</b></div>` : ''}
      ${cita.est === 'novino' ? `<div class="clock"><span>No vino</span><span>se le anotaron ${pesos(MULTA)}</span></div>` : ''}
      ${cita.est === 'llego' ? `<div class="clock"><span style="color:var(--green)">● Llegó ${cita.llego}</span><span>${cita.sinHora ? 'sin hora' : ''}</span></div>` : ''}
      ${abierta && esHoy && !enCurso() ? `<button class="btn" data-a="empezar" data-id="${cita.id}">Empezar corte</button>` : ''}
      ${abierta && f.editH ? `<div class="fld"><span class="cap">Nueva hora</span><div class="dos"><input class="inp" type="date" data-in="e-fecha" value="${f.fecha}" aria-label="Día"><input class="inp" type="time" step="900" data-in="e-hora" value="${f.hora}" aria-label="Hora"></div>
          <div class="segc" style="grid-template-columns:1fr 1fr">${Object.entries(SERV).map(([key, x]) => `<button class="${f.serv === key ? 'on' : ''}" data-a="e-serv" data-v="${key}">${x.n}</button>`).join('')}</div>
          <button class="btn dark" data-a="guardar-hora">Guardar cambios</button></div>`
        : abierta ? `<button class="btn dark" data-a="cambiar-hora">Cambiar hora o servicio</button>` : ''}
      <button class="btn dark" data-a="ficha" data-k="${cita.cl}">Ver ficha de ${esc(primerNombre(c.n))}</button>
      ${abierta && esHoy ? `<button class="link" data-a="novino" data-id="${cita.id}">No vino</button>` : ''}
      ${cita.est !== 'encurso' && cita.est !== 'listo' ? `<button class="link red" data-a="quitar">${E.quitar ? 'Toca otra vez para quitarla' : 'Quitar de la agenda'}</button>` : ''}`;
  }
  return `<div class="dim" data-a="cerrar-fondo"><div class="sheet" role="dialog" aria-modal="true"><span class="handle"></span>${body}</div></div>`;
}
const mensajeNoVino = (c, cita) => `Hola ${primerNombre(c.n)}, no alcanzaste a llegar a tu hora de hoy a las ${cita.h}. Como dice nuestra política, se suman ${pesos(MULTA)} a tu próximo corte. Cuando quieras, agenda de nuevo por aquí.`;
function sugerencias() {
  const q = normal(E.form.nombre);
  if (!q || E.form.cl) return '';
  return Object.values(E.clientes).filter((c) => normal(c.n).includes(q)).slice(0, 6)
    .map((c) => `<button data-a="sug" data-k="${c.id}">${esc(c.n)}</button>`).join('');
}

function visor() {
  if (!E.viewer) return '';
  const k = E.viewer.k, c = cli(k), fs = Array.isArray(E.fotos[k]) ? E.fotos[k] : [];
  const i = Math.min(E.viewer.i, Math.max(0, fs.length - 1)), f = fs[i];
  const img = f ? `<img src="${f.data}" alt="Corte del ${fechaCorta(f.fecha)}">` : c.thumb ? `<img src="${c.thumb}" alt="">` : 'Cargando fotos…';
  return `<div class="viewer" role="dialog"><div class="sh-head"><div><div class="nm" style="font-size:20px">${esc(c.n)}</div><div class="sub">${f ? 'Corte del ' + fechaCorta(f.fecha) : ''}</div></div><button class="x" data-a="cerrar-visor" aria-label="Cerrar">✕</button></div>
    <div class="big">${img}</div>
    ${fs.length > 1 ? `<div class="strip">${fs.map((x, j) => `<button class="${j === i ? 'on' : ''}" data-a="vi" data-i="${j}"><img src="${x.data}" alt="${fechaCorta(x.fecha)}"></button>`).join('')}</div>` : ''}
    ${(c.corte || []).length ? spec(c) : ''}</div>`;
}

function urlQR() {
  const base = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  return `${base}llegue.html?p=${E.p}${EMU ? '&emu=1' : ''}`;
}
function pantallaQR() {
  if (!E.qr) return '';
  let dibujo = '<p>Preparando el código…</p>';
  if (E.p && typeof window.qrcode === 'function') { const q = window.qrcode(0, 'M'); q.addData(urlQR()); q.make(); dibujo = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true }); }
  else if (E.p) dibujo = '<p>Se necesita señal la primera vez para dibujar el código.</p>';
  return `<div class="qrfull" role="dialog"><div class="logo"><img src="iconos/icon-192.png" alt=""></div><span class="marca">BVNDITO CUTSSS</span>
    <h3>Escanea para avisar<br>que llegaste</h3><div class="qr" data-qr-url="${E.p ? esc(urlQR()) : ''}">${dibujo}</div>
    <p>Apunta la cámara de tu celular al código.</p>
    <button class="listo" data-a="cerrar-qr">Listo</button></div>`;
}

/* ---------- Pantallas de entrada ---------- */
function pantalla(titulo, texto, extra = '') {
  return `<div class="scr"><div class="pantalla">${mono.replace('class="mono"', 'class="mono" style="width:76px;height:76px;margin:0 auto"')}<h1>${titulo}</h1><p>${texto}</p>${extra}</div></div>`;
}

function vista() {
  if (E.fase === 'sinConfig') return pantalla('Falta conectar la base de datos', 'Esta copia de la app todavía no tiene su proyecto de Firebase. Fabián lo agrega en js/config.js.');
  if (E.fase === 'bienvenida') return pantalla('Falta tu link', 'Abre el link que te mandó Fabián. Si lo tienes copiado, pégalo aquí:',
    `<input class="inp" data-in="link" placeholder="Pega aquí el link" autocomplete="off" aria-label="Link"><button class="btn" data-a="pegar-link">Entrar</button>`);
  if (E.fase === 'error') return pantalla('No se pudo conectar', 'La primera vez se necesita señal. Revisa el wifi o los datos y vuelve a abrir la app.', `<button class="btn dark" data-a="recargar">Reintentar</button>`);
  if (E.fase === 'cargando') return pantalla('Bvndito Cutsss', 'Cargando tu agenda…');
  const pant = { hoy: vistaHoy, foco: vistaFoco, clientes: vistaClientes, ficha: vistaFicha, numeros: vistaNumeros }[E.screen] || vistaHoy;
  const html = pant();
  const tab = E.screen === 'ficha' ? (E.from === 'foco' ? 'hoy' : E.from) : E.screen;
  const nav = E.screen === 'foco' ? '' : `<nav class="nav">${[['hoy', 'Hoy', ic.hoy], ['clientes', 'Clientes', ic.cli], ['numeros', 'Mis números', ic.num]].map(([k, n, i]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${i}${n}</button>`).join('')}</nav>`;
  const fab = E.screen === 'hoy' ? `<button class="fab" data-a="nueva" aria-label="Agregar hora">${ic.mas}</button>` : '';
  const toast = E.toast ? `<div class="toast" role="status"><span class="ok ${E.toast[2] ? 'mal' : ''}">${E.toast[2] ? '!' : '✓'}</span><div>${esc(E.toast[0])}<span>${esc(E.toast[1])}</span></div></div>` : '';
  return `<div class="scr">${html}</div>${fab}${nav}${hoja()}${visor()}${pantallaQR()}${toast}`;
}

/* ---------- Dibujar ---------- */
let ultimaPantalla = '', ultimaHoja = '', pendiente = false;
function render() {
  const a = document.activeElement;
  if (a && root.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.type !== 'file' && !E.forzar) { pendiente = true; return; }
  E.forzar = false; pendiente = false;
  const scr = root.querySelector('.scr'), y = scr ? scr.scrollTop : 0;
  const sh = root.querySelector('.sheet'), sy = sh ? sh.scrollTop : 0;
  const clave = E.fase + E.screen + E.ficha + E.dia;
  root.innerHTML = vista();
  if (clave === ultimaPantalla) { const s2 = root.querySelector('.scr'); if (s2) s2.scrollTop = y; }
  if (E.sheet && E.sheet === ultimaHoja) { const h2 = root.querySelector('.sheet'); if (h2) h2.scrollTop = sy; }
  ultimaPantalla = clave; ultimaHoja = E.sheet;
}
let cuadro = 0;
const pedirRender = () => { if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; render(); }); };
root.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (pendiente && !(a && root.contains(a) && a.tagName === 'INPUT')) render(); }, 450));

/* ---------- Acciones ---------- */
const horaSugerida = () => { const d = new Date(); d.setMinutes(0); d.setHours(d.getHours() + 1); return hhmm(d); };

function act(a, d) {
  const cur = enCurso();
  switch (a) {
    case 'tab': E.screen = d.v; E.editNota = false; if (d.v === 'hoy') E.dia = hoyISO(); break;
    case 'dia': E.dia = d.v === '0' ? hoyISO() : sumarDias(E.dia, +d.v); break;
    case 'inst-ok': guardarLocal('bv_inst', '1'); break;
    case 'compactar': { const c = E.citas.find((x) => x.id === d.id); if (c) E.cmp[c.id] = !(E.cmp[c.id] ?? (c.est !== 'llego')); break; }
    case 'empezar': {
      if (cur && cur.id !== d.id) { avisa(`Termina primero a ${primerNombre(cli(cur.cl).n)}`, 'Hay un corte en curso'); return; }
      cambiar('citas', d.id, { est: 'encurso', run: { acc: 0, desde: Date.now() }, inicio: Date.now() });
      E.sheet = null; E.screen = 'foco'; E.cobro = null; break; }
    case 'foco': E.screen = 'foco'; break;
    case 'pausa': if (cur) cambiar('citas', cur.id, { run: { acc: elapsed(cur), desde: null } }); break;
    case 'play': if (cur) cambiar('citas', cur.id, { run: { acc: elapsed(cur), desde: Date.now() } }); break;
    case 'cobrar': {
      if (!cur) return;
      if (corriendo(cur)) cambiar('citas', cur.id, { run: { acc: elapsed(cur), desde: null } });
      const c = cli(cur.cl);
      if (!E.cobro || E.cobro.id !== cur.id) E.cobro = { id: cur.id, serv: cur.serv || 'basico', extras: [], pago: 'efectivo', foto: null, thumb: null, debe: !!c.debe };
      E.sheet = 'cobro'; break; }
    case 'serv': E.cobro.serv = d.v; break;
    case 'extra': { const e = E.cobro.extras, i = e.indexOf(d.v); i < 0 ? e.push(d.v) : e.splice(i, 1); break; }
    case 'debe': E.cobro.debe = !E.cobro.debe; break;
    case 'pago': E.cobro.pago = d.v; break;
    case 'confirmar': confirmarCobro(cur); return;
    case 'novino': E.nv = d.id; E.sheet = 'novino'; break;
    case 'ig': E.avisarIG = !E.avisarIG; break;
    case 'confirmar-nv': {
      const cita = E.citas.find((x) => x.id === E.nv); if (!cita) break;
      const c = cli(cita.cl);
      let copiado = false;
      if (E.avisarIG && navigator.clipboard) { navigator.clipboard.writeText(mensajeNoVino(c, cita)).catch(() => {}); copiado = true; }
      const b = writeBatch(db);
      b.set(ref('citas', cita.id), { est: 'novino' }, { merge: true });
      b.set(ref('clientes', cita.cl), { debe: (c.debe || 0) + MULTA }, { merge: true });
      b.commit().catch(fallo);
      E.sheet = null;
      avisa(`${c.n} no vino`, copiado ? 'Mensaje copiado: pégalo en su chat de Instagram' : `Se le anotaron ${pesos(MULTA)}`);
      return; }
    case 'qr': E.qr = true; break;
    case 'cerrar-qr': E.qr = false; break;
    case 'cerrar': E.sheet = null; E.quitar = false; break;
    case 'ver': E.viewer = { k: d.k, i: +(d.i || 0) }; cargarFotos(d.k); break;
    case 'vi': E.viewer.i = +d.i; break;
    case 'cerrar-visor': E.viewer = null; break;
    case 'ficha': if (E.screen !== 'ficha') E.from = E.screen; E.ficha = d.k; E.screen = 'ficha'; E.editNota = false; E.sheet = null; cargarFotos(d.k); break;
    case 'back': E.screen = E.from; break;
    case 'editar': { const c = cli(E.ficha); E.form = { n: c.n, tel: c.tel || '', corte: [...(c.corte || []).map((x) => ({ k: x.k, v: x.v })), { k: '', v: '' }] }; E.editNota = true; break; }
    case 'cancelar-nota': E.editNota = false; break;
    case 'guardar-nota': {
      const f = E.form, n = capitalizar(f.n);
      if (!n) { avisa('Falta el nombre', 'Escribe el nombre del cliente', true); return; }
      cambiar('clientes', E.ficha, { n, tel: f.tel.trim(), corte: f.corte.map((x) => ({ k: capitalizar(x.k), v: x.v.trim() })).filter((x) => x.k && x.v) });
      E.editNota = false; avisa('Ficha guardada', n); return; }
    case 'perdonar': cambiar('clientes', E.ficha, { debe: 0 }); break;
    case 'per': E.per = d.v; break;
    case 'nueva': {
      const c = d.k ? cli(d.k) : null;
      E.form = { nombre: c ? c.n : '', tel: c ? (c.tel || '') : '', cl: c ? c.id : null, fecha: E.screen === 'hoy' && E.dia >= hoyISO() ? E.dia : hoyISO(), hora: horaSugerida(), serv: 'basico', otro: false };
      E.form.otro = E.form.fecha > sumarDias(hoyISO(), 1);
      E.sheet = 'nueva'; break; }
    case 'sug': { const c = cli(d.k); Object.assign(E.form, { nombre: c.n, tel: c.tel || '', cl: c.id }); break; }
    case 'n-dia': E.form.fecha = d.v; E.form.otro = false; break;
    case 'n-otro': E.form.otro = true; if (E.form.fecha <= sumarDias(hoyISO(), 1)) E.form.fecha = sumarDias(hoyISO(), 2); break;
    case 'n-serv': E.form.serv = d.v; break;
    case 'guardar-nueva': guardarNueva(); return;
    case 'nuevo-cliente': E.form = { nombre: '', tel: '' }; E.sheet = 'cliente'; break;
    case 'guardar-cliente': {
      const n = capitalizar(E.form.nombre); if (!n) { avisa('Falta el nombre', '', true); return; }
      const ya = buscarCliente(n, E.form.tel);
      const id = ya ? ya.id : nuevoId('clientes');
      if (!ya) cambiar('clientes', id, { n, tel: E.form.tel.trim(), corte: [], vis: 0, creado: Date.now() });
      E.sheet = null; E.from = 'clientes'; E.ficha = id; E.screen = 'ficha'; break; }
    case 'cita': E.citaSel = d.id; E.sheet = 'cita'; E.quitar = false; E.form = {}; break;
    case 'cambiar-hora': { const c = E.citas.find((x) => x.id === E.citaSel); E.form = { editH: true, fecha: c.fecha, hora: c.h, serv: c.serv || 'basico' }; break; }
    case 'e-serv': E.form.serv = d.v; break;
    case 'guardar-hora': cambiar('citas', E.citaSel, { fecha: E.form.fecha, h: E.form.hora, serv: E.form.serv }); E.sheet = null; avisa('Hora cambiada', `${fechaLarga(E.form.fecha)} · ${E.form.hora}`); return;
    case 'quitar': {
      if (!E.quitar) { E.quitar = true; break; }
      setDoc(ref('citas', E.citaSel), { est: 'quitada' }, { merge: true }).catch(fallo);
      E.sheet = null; E.quitar = false; avisa('Hora quitada de la agenda', ''); return; }
    case 'pegar-link': {
      const v = (E.form.link || '').trim(), m = v.match(/[?&]b=([A-Za-z0-9]+)/), b = m ? m[1] : v;
      if (!codigoOk(b)) { avisa('Ese link no sirve', 'Copia el link completo que te mandó Fabián', true); return; }
      guardarLocal('bv_llave', b); location.href = location.pathname + '?b=' + b + (EMU ? '&emu=1' : ''); return; }
    case 'recargar': location.reload(); return;
    default: return;
  }
  E.forzar = true; render();
}

function guardarNueva() {
  const f = E.form, n = capitalizar(f.nombre);
  if (!n) { avisa('Falta el nombre', 'Escribe a quién le agendas', true); return; }
  if (!/^\d{2}:\d{2}$/.test(f.hora || '')) { avisa('Falta la hora', 'Elige a qué hora viene', true); return; }
  const b = writeBatch(db);
  let id = f.cl;
  if (!id) { const ya = buscarCliente(n, f.tel); if (ya) id = ya.id; }
  if (!id) { id = nuevoId('clientes'); b.set(ref('clientes', id), { n, tel: (f.tel || '').trim(), corte: [], vis: 0, creado: Date.now() }); }
  else if (f.tel && !cli(id).tel) b.set(ref('clientes', id), { tel: f.tel.trim() }, { merge: true });
  b.set(ref('citas', nuevoId('citas')), { fecha: f.fecha, h: f.hora, cl: id, serv: f.serv, est: 'pendiente', creado: Date.now() });
  b.commit().catch(fallo);
  E.sheet = null; E.screen = 'hoy'; E.dia = f.fecha;
  avisa(`Agendado: ${primerNombre(n)}`, `${f.fecha === hoyISO() ? 'Hoy' : fechaLarga(f.fecha)} · ${f.hora}`);
}

function confirmarCobro(cur) {
  if (!cur || !E.cobro) return;
  const c = cli(cur.cl), k = E.cobro, seg = elapsed(cur), min = Math.max(1, Math.round(seg / 60));
  const total = SERV[k.serv].p + k.extras.reduce((a, x) => a + EXTRA[x].p, 0) + (k.debe ? (c.debe || 0) : 0);
  const b = writeBatch(db);
  b.set(ref('citas', cur.id), { est: 'listo', total, pago: k.pago, serv: k.serv, extras: k.extras, min, run: { acc: seg, desde: null }, fin: Date.now() }, { merge: true });
  b.set(ref('visitas', nuevoId('visitas')), { fecha: cur.fecha, cl: cur.cl, n: c.n, serv: k.serv, total, pago: k.pago, min, extras: k.extras, cita: cur.id });
  const cambios = { vis: (c.vis || 0) + 1, ult: cur.fecha };
  if (k.debe) cambios.debe = 0;
  if (k.foto) cambios.thumb = k.thumb;
  b.set(ref('clientes', cur.cl), cambios, { merge: true });
  if (k.foto) b.set(ref('fotos', nuevoId('fotos')), { cl: cur.cl, fecha: cur.fecha, data: k.foto, creado: Date.now() });
  b.commit().catch(fallo);
  delete E.fotos[cur.cl];
  E.sheet = null; E.cobro = null; E.screen = 'hoy'; E.dia = hoyISO();
  avisa(`${c.n} · ${pesos(total)}`, `${min} min · ${PAGO[k.pago]}${k.foto ? ' · foto guardada' : ''}`);
}

async function fotoElegida(tipo, file) {
  try {
    if (tipo === 'cobro') {
      E.cobro.subiendo = true; E.forzar = true; render();
      const [foto, mini] = await Promise.all([comprimir(file, 1000, 0.72), comprimir(file, 240, 0.7)]);
      Object.assign(E.cobro, { foto, thumb: mini, subiendo: false });
    } else {
      const k = E.ficha;
      const [foto, mini] = await Promise.all([comprimir(file, 1000, 0.72), comprimir(file, 240, 0.7)]);
      const b = writeBatch(db);
      b.set(ref('fotos', nuevoId('fotos')), { cl: k, fecha: hoyISO(), data: foto, creado: Date.now() });
      b.set(ref('clientes', k), { thumb: mini }, { merge: true });
      b.commit().catch(fallo);
      delete E.fotos[k]; cargarFotos(k);
      avisa('Foto agregada', cli(k).n);
    }
  } catch (e) { if (E.cobro) E.cobro.subiendo = false; avisa('No se pudo usar esa foto', 'Prueba con otra', true); }
  E.forzar = true; render();
}

async function cargarFotos(k) {
  if (Array.isArray(E.fotos[k]) || E.fotos[k] === 'cargando') return;
  E.fotos[k] = 'cargando';
  try {
    const s = await getDocs(query(R('fotos'), where('cl', '==', k)));
    E.fotos[k] = s.docs.map((x) => Object.assign({ id: x.id }, x.data())).sort((a, b) => (b.creado || 0) - (a.creado || 0));
  } catch (e) { console.error(e); delete E.fotos[k]; }
  pedirRender();
}

/* ---------- Eventos ---------- */
root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || !root.contains(b)) return;
  if (b.dataset.a === 'cerrar-fondo') { if (e.target === b) act('cerrar', {}); return; }
  act(b.dataset.a, b.dataset);
});
root.addEventListener('input', (e) => {
  const t = e.target, k = t.dataset.in; if (!k) return;
  const f = E.form;
  if (k === 'buscar') { E.q = t.value; root.querySelector('[data-lista]').innerHTML = listaClientes(); return; }
  if (k === 'link') f.link = t.value;
  if (k === 'n-nombre') { f.nombre = t.value; f.cl = null; const s = root.querySelector('[data-sugs]'); if (s) s.innerHTML = sugerencias(); }
  if (k === 'n-tel') f.tel = t.value;
  if (k === 'n-fecha') f.fecha = t.value || f.fecha;
  if (k === 'n-hora') f.hora = t.value;
  if (k === 'c-nombre') f.nombre = t.value;
  if (k === 'c-tel') f.tel = t.value;
  if (k === 'e-fecha') f.fecha = t.value || f.fecha;
  if (k === 'e-hora') f.hora = t.value;
  if (k === 'f-n') f.n = t.value;
  if (k === 'f-tel') f.tel = t.value;
  if (k === 'f-k' || k === 'f-v') {
    const i = +t.dataset.i; f.corte[i][k === 'f-k' ? 'k' : 'v'] = t.value;
    const ult = f.corte[f.corte.length - 1];
    if (ult.k || ult.v) { f.corte.push({ k: '', v: '' }); const box = t.closest('.edit'), fila = document.createElement('div'); const j = f.corte.length - 1;
      fila.className = 'r'; fila.innerHTML = `<input data-in="f-k" data-i="${j}" placeholder="Ej: Barba" aria-label="Parte"><input data-in="f-v" data-i="${j}" placeholder="Ej: Perfilada" aria-label="Cómo">`;
      box.insertBefore(fila, box.lastElementChild); }
  }
});
root.addEventListener('change', (e) => {
  const t = e.target.dataset.file; if (!t || !e.target.files || !e.target.files[0]) return;
  fotoElegida(t, e.target.files[0]);
});

// Reloj: solo se actualizan los números, sin redibujar la pantalla.
setInterval(() => {
  if (E.fase !== 'app') return;
  const cur = enCurso();
  if (E.dia !== hoyISO() && E.diaVisto === hoyISO() && E.screen === 'hoy') { E.dia = hoyISO(); pedirRender(); }
  E.diaVisto = hoyISO();
  if (!cur || !corriendo(cur)) return;
  const e = elapsed(cur);
  root.querySelectorAll(`[data-tm="${cur.id}"]`).forEach((x) => { x.textContent = fmt(e); });
  const ring = root.querySelector('[data-ring]');
  if (ring) {
    const C = 2 * Math.PI * 92; ring.setAttribute('stroke-dashoffset', (C * (1 - Math.min(1, e / (RESERVA_MIN * 60)))).toFixed(1));
    if (e > RESERVA_MIN * 60) { ring.setAttribute('stroke', '#ff5a4f'); const o = root.querySelector('[data-over]'); if (o) { o.textContent = 'pasó la hora reservada'; o.className = 'over'; } }
  }
}, 1000);

/* ---------- Llegadas desde el QR ---------- */
let oyendoLlegadas = false;
function unirse() {
  setDoc(doc(db, 'locales', E.p), { sello: E.b, duenos: arrayUnion(E.uid) }, { merge: true })
    .then(oirLlegadas)
    .catch((e) => { console.error('unirse', e); setTimeout(unirse, 15000); });
}
function oirLlegadas() {
  if (oyendoLlegadas) return; oyendoLlegadas = true;
  onSnapshot(collection(db, 'locales', E.p, 'llegadas'), (s) => { E.llegadas = s.docs; procesarLlegadas(); },
    (e) => { console.error('llegadas', e); oyendoLlegadas = false; setTimeout(oirLlegadas, 15000); });
}
// Cada aviso se procesa dentro de una transacción que lo borra: si la app está abierta en dos lados
// (por ejemplo Safari y el ícono de inicio), solo uno lo convierte en cita.
function procesarLlegadas() {
  if (!E.cargado.clientes || !E.cargado.citas) return;
  for (const d of E.llegadas) {
    if (E.procesados.has(d.id)) continue;
    E.procesados.add(d.id);
    const refLl = doc(db, 'locales', E.p, 'llegadas', d.id);
    runTransaction(db, async (tx) => {
      const s = await tx.get(refLl);
      if (!s.exists()) return null;
      return convertirLlegada(tx, refLl, s.data());
    }).then((aviso) => { if (aviso) avisa(aviso[0], aviso[1]); }).catch((e) => { console.error('llegada', e); E.procesados.delete(d.id); });
  }
}
function convertirLlegada(b, refLl, x) {
  const cuando = x.ts && x.ts.toDate ? x.ts.toDate() : new Date();
  b.delete(refLl);
  if (hoyISO(cuando) !== hoyISO()) return null;
  {
    const hora = hhmm(cuando), hoy = hoyISO();
    let c = buscarCliente(x.nombre, x.tel);
    const pendientes = citasDe(hoy).filter((y) => y.est === 'pendiente');
    let cita = c && pendientes.find((y) => y.cl === c.id);
    if (!cita) {
      const n1 = normal(x.nombre).split(' ')[0];
      const cand = pendientes.filter((y) => normal(cli(y.cl).n).split(' ')[0] === n1);
      if (cand.length === 1) { cita = cand[0]; c = cli(cita.cl); }
    }
    if (cita) {
      b.set(ref('citas', cita.id), { est: 'llego', llego: hora }, { merge: true });
      if (x.tel && !c.tel) b.set(ref('clientes', c.id), { tel: x.tel }, { merge: true });
      E.cmp[cita.id] = undefined;
    } else {
      let id = c && c.id;
      if (!id) { id = nuevoId('clientes'); b.set(ref('clientes', id), { n: capitalizar(x.nombre), tel: x.tel || '', corte: [], vis: 0, creado: Date.now() }); }
      b.set(ref('citas', nuevoId('citas')), { fecha: hoy, h: hora, cl: id, serv: 'basico', est: 'llego', llego: hora, sinHora: true, conHora: !!x.conHora, creado: Date.now() });
    }
    return [`${capitalizar(primerNombre(x.nombre))} llegó`, cita ? `Su hora ${cita.h}` : 'Sin hora: quedó en la fila'];
  }
}

/* ---------- Arranque ---------- */
function oirDatos() {
  onSnapshot(doc(db, 'barberias', E.b, 'config', 'app'), META, (s) => {
    if (s.exists()) { const p = s.data().p; if (p && p !== E.p) { E.p = p; unirse(); } }
    else if (!s.metadata.fromCache && !E.creando) { E.creando = true; setDoc(s.ref, { p: idAzar(20), creado: Date.now() }).catch(fallo); }
  }, (e) => console.error('config', e));
  const listo = () => {
    if (E.fase === 'cargando' && E.cargado.clientes && E.cargado.citas) E.fase = 'app';
    procesarLlegadas(); pedirRender();
  };
  onSnapshot(R('clientes'), META, (s) => {
    E.clientes = {}; s.docs.forEach((d) => { E.clientes[d.id] = Object.assign({ id: d.id }, d.data()); });
    E.cargado.clientes = true; E.offline = s.metadata.fromCache; listo();
  }, (e) => console.error('clientes', e));
  onSnapshot(query(R('citas'), where('fecha', '>=', sumarDias(hoyISO(), -21))), META, (s) => {
    E.citas = s.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((c) => c.est !== 'quitada');
    E.cargado.citas = true; E.offline = s.metadata.fromCache; listo();
  }, (e) => console.error('citas', e));
  onSnapshot(query(R('visitas'), where('fecha', '>=', mesAntes(hoyISO().slice(0, 8) + '01'))), (s) => {
    E.visitas = s.docs.map((d) => Object.assign({ id: d.id }, d.data())); pedirRender();
  }, (e) => console.error('visitas', e));
}

async function arrancar() {
  const cfg = EMU ? CONFIG_EMU : firebaseConfig;
  if (!cfg) { E.fase = 'sinConfig'; return render(); }
  const qs = new URLSearchParams(location.search);
  let b = qs.get('b');
  if (!codigoOk(b)) { const g = leerLocal('bv_llave'); b = codigoOk(g) ? g : null; }
  if (!b) { E.fase = 'bienvenida'; E.form = { link: '' }; return render(); }
  guardarLocal('bv_llave', b);
  // El link con ?b= queda en la barra: así "Agregar a inicio" en el iPhone guarda la app ya con el código.
  if (qs.get('b') !== b) { qs.set('b', b); history.replaceState(null, '', location.pathname + '?' + qs.toString()); }
  E.b = b; E.fase = 'cargando'; render();
  iniciar(cfg, EMU, true);
  try { E.uid = await entrar(); } catch (e) { console.error(e); E.fase = 'error'; return render(); }
  oirDatos();
}

if ('serviceWorker' in navigator && !EMU) navigator.serviceWorker.register('sw.js').catch(() => {});
arrancar();
window.__E = E; // para las pruebas automáticas
