// Prueba completa con los emuladores de Firebase: barbero + clientes en navegadores separados.
// Uso: node pruebas/e2e.cjs   (usa firebase-tools y Playwright de D:\CUADERNO_JUAN\pruebas)
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { webkit } = require('D:/CUADERNO_JUAN/pruebas/node_modules/playwright');

const RAIZ = path.join(__dirname, '..');
const PUERTO = 5501;
const FOTOS = path.join(__dirname, 'capturas');
fs.mkdirSync(FOTOS, { recursive: true });
let fallas = 0;
const ok = (nombre, cond, extra) => { console.log(`${cond ? '✓' : '✗'} ${nombre}${cond || !extra ? '' : '  → ' + extra}`); if (!cond) fallas++; };

function servidor() {
  const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(RAIZ, p);
    if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => s.listen(PUERTO, '127.0.0.1', () => r(s)));
}
async function emuladores() {
  const arriba = (u) => fetch(u).then(() => true).catch(() => false);
  if ((await arriba('http://127.0.0.1:8080/')) && (await arriba('http://127.0.0.1:9099/'))) { console.log('(emuladores ya corriendo)'); return () => {}; }
  const bin = '"D:/CUADERNO_JUAN/pruebas/node_modules/.bin/firebase.cmd"';
  const proc = spawn(`${bin} emulators:start --only auth,firestore --project demo-bvndito`, { cwd: RAIZ, shell: true });
  let salida = '';
  await new Promise((listo, error) => {
    const t = setTimeout(() => error(new Error('Los emuladores no partieron:\n' + salida.slice(-1500))), 120000);
    const leer = (d) => { salida += d.toString(); if (/All emulators ready/.test(salida)) { clearTimeout(t); listo(); } };
    proc.stdout.on('data', leer); proc.stderr.on('data', leer);
    proc.on('exit', () => { clearTimeout(t); error(new Error('Los emuladores se cerraron:\n' + salida.slice(-1500))); });
  });
  return () => { try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* ya cerró */ } };
}
const navegadores = [];
async function celular(nombre) {
  const b = await webkit.launch(); navegadores.push(b);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'es-CL', timezoneId: 'America/Santiago' });
  const page = await ctx.newPage();
  page.errores = [];
  // El canal de Firestore contra el emulador local se corta solo en WebKit (no pasa con el servidor real): se ignora.
  const ruido = /Could not reach|access control|WebChannel|transport errored|Failed to load resource/i;
  page.on('pageerror', (e) => { if (!ruido.test(e.message)) page.errores.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !ruido.test(m.text())) page.errores.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/127\.0\.0\.1:(8080|9099)/.test(r.url())) page.errores.push(`${r.status()} ${r.url()}`); });
  page.nombre = nombre;
  return page;
}
const ver = (p, t, ms = 10000) => p.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
const toca = async (p, sel) => {
  try { await p.locator(sel).first().click({ timeout: 8000 }); } catch (e) { await p.screenshot({ path: path.join(FOTOS, 'FALLA-' + p.nombre + '.png') }); throw e; }
  await p.waitForTimeout(250);
};
const foto = (p, n) => p.screenshot({ path: path.join(FOTOS, n + '.png') });

(async () => {
  const cerrarEmu = await emuladores();
  const srv = await servidor();
  const B = 'Prueba' + Date.now() + 'abcdefghijklmn';
  const base = `http://127.0.0.1:${PUERTO}`;
  try {
    // 1. El barbero abre su link por primera vez
    const bar = await celular('barbero');
    await bar.goto(`${base}/index.html?b=${B}&emu=1`);
    ok('Barbero: la app abre con el día vacío', await ver(bar, 'Todavía no hay nadie hoy', 20000));
    await foto(bar, '01-hoy-vacio');

    // 2. Agrega una hora para Tomás en una hora futura
    const h = new Date(); h.setHours(h.getHours() + 1, 0, 0, 0);
    const hora = `${String(h.getHours()).padStart(2, '0')}:00`;
    await toca(bar, '.fab');
    await bar.fill('[data-in="n-nombre"]', 'tomás rojas');
    await bar.fill('[data-in="n-hora"]', hora);
    await toca(bar, '[data-a="guardar-nueva"]');
    ok('Barbero: agrega la hora de Tomás', await ver(bar, 'Tomás Rojas'));

    // 3. El QR apunta a la página del cliente
    await toca(bar, '[data-a="qr"]');
    await bar.waitForFunction(() => document.querySelector('.qr svg'), null, { timeout: 15000 }).catch(() => {});
    const url = await bar.getAttribute('.qr', 'data-qr-url');
    ok('Barbero: el QR se dibuja con el link del local', !!url && /llegue\.html\?p=/.test(url) && (await bar.locator('.qr svg').count()) === 1, url);
    await foto(bar, '02-qr');
    await toca(bar, '[data-a="cerrar-qr"]');

    // 4. Llega Diego sin hora, desde su celular
    const c1 = await celular('cliente1');
    await c1.goto(url.replace(/^https?:\/\/[^/]+/, base));
    ok('Cliente: ve la pantalla para avisar', await ver(c1, '¿Llegaste?'));
    await foto(c1, '03-cliente-form');
    await c1.fill('#nombre', 'diego fuentes');
    await c1.fill('#tel', '+56 9 8123 4504');
    await toca(c1, '[data-hora="0"]');
    ok('Cliente: confirma que avisó', await ver(c1, 'Listo, Diego', 15000));
    await foto(c1, '04-cliente-listo');
    ok('Barbero: le aparece Diego como llegado', await ver(bar, 'Diego Fuentes', 15000) && await ver(bar, 'sin hora', 5000));
    await bar.waitForTimeout(800);
    await foto(bar, '05-hoy-llego-diego');

    // 5. El cliente no puede leer las llegadas de otros
    const lectura = await c1.evaluate(async () => {
      const m = await import('/js/db.js');
      const p = new URLSearchParams(location.search).get('p');
      try { await m.getDocs(m.collection(m.db, 'locales', p, 'llegadas')); return 'leyó'; } catch (e) { return e.code || e.message; }
    });
    ok('Seguridad: el cliente no puede leer las llegadas', /permission/i.test(lectura), lectura);
    const lectura2 = await c1.evaluate(async () => {
      const m = await import('/js/db.js');
      const p = new URLSearchParams(location.search).get('p');
      try { const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'); await getDoc(m.doc(m.db, 'locales', p)); return 'leyó'; } catch (e) { return e.code || e.message; }
    });
    ok('Seguridad: el cliente no puede leer el código del barbero', /permission/i.test(lectura2), lectura2);

    // 6. Llega Tomás, que tenía hora (escribe solo su primer nombre)
    const c2 = await celular('cliente2');
    await c2.goto(url.replace(/^https?:\/\/[^/]+/, base));
    await c2.fill('#nombre', 'Tomás');
    await toca(c2, '[data-hora="1"]');
    ok('Cliente 2: confirma', await ver(c2, 'Listo, Tomás', 15000));
    await bar.waitForTimeout(1500);
    const citas = await bar.evaluate(() => window.__E.citas.map((c) => ({ n: window.__E.clientes[c.cl] && window.__E.clientes[c.cl].n, est: c.est, sinHora: !!c.sinHora })));
    ok('Barbero: Tomás quedó en su misma hora (no duplicado)', citas.filter((c) => c.n === 'Tomás Rojas').length === 1 && citas.find((c) => c.n === 'Tomás Rojas').est === 'llego', JSON.stringify(citas));

    // 7. Corte de Diego: empezar, pausar, seguir, cobrar con foto
    await toca(bar, '.next [data-a="compactar"]').catch(() => {});
    await bar.locator('[data-a="empezar"]').first().click();
    ok('Barbero: modo foco con el reloj corriendo', await ver(bar, 'Corriendo'));
    await bar.waitForTimeout(2200);
    await toca(bar, '[data-a="pausa"]');
    const t1 = await bar.textContent('.ring [data-tm]');
    await bar.waitForTimeout(1500);
    const t2 = await bar.textContent('.ring [data-tm]');
    ok('Barbero: la pausa detiene el reloj', t1 === t2 && t1 !== '00:00', `${t1} → ${t2}`);
    await toca(bar, '[data-a="play"]');
    await bar.waitForTimeout(1200);
    await foto(bar, '06-foco');
    await toca(bar, '[data-a="cobrar"]');
    const c3 = await bar.textContent('.clock .t'); await bar.waitForTimeout(1300); const c4 = await bar.textContent('.clock .t');
    ok('Barbero: al cobrar el reloj queda detenido', c3 === c4, `${c3} → ${c4}`);
    await toca(bar, '[data-a="pago"][data-v="transferencia"]');
    await bar.setInputFiles('[data-file="cobro"]', path.join(RAIZ, 'iconos', 'icon-512.png'));
    ok('Barbero: la foto queda lista', await ver(bar, 'Foto lista'));
    await foto(bar, '07-cobro');
    await toca(bar, '[data-a="confirmar"]');
    ok('Barbero: la caja suma el corte', await ver(bar, '10.000'));
    await bar.waitForTimeout(600);
    await foto(bar, '08-cobrado');

    // 8. Tomás no vino (prueba la hoja)
    await bar.waitForTimeout(3500);
    const cartaTomas = bar.locator('[data-a="novino"]');
    if (await cartaTomas.count() === 0) await toca(bar, '.next [data-a="compactar"]');
    await toca(bar, '[data-a="novino"]');
    ok('Barbero: hoja de "No vino" con aviso por Instagram', await ver(bar, 'Avisarle por Instagram'));
    await foto(bar, '09-novino');
    await toca(bar, '[data-a="confirmar-nv"]');
    ok('Barbero: Tomás queda como "No vino"', await ver(bar, 'No vino', 5000));

    // 9. Ficha de Diego con su foto, y editar su corte
    await toca(bar, '[data-a="tab"][data-v="clientes"]');
    await toca(bar, '.cli:has-text("Diego")');
    ok('Ficha: muestra la foto del corte', await bar.locator('.hero img').count() === 1);
    await toca(bar, '[data-a="editar"]');
    await bar.fill('[data-in="f-k"][data-i="0"]', 'lados');
    await bar.fill('[data-in="f-v"][data-i="0"]', 'Fade medio desde 0.5');
    await toca(bar, '[data-a="guardar-nota"]');
    ok('Ficha: guarda el corte por partes', await ver(bar, 'Fade medio desde 0.5'));
    await foto(bar, '10-ficha');

    // 10. Mis números
    await toca(bar, '[data-a="tab"][data-v="numeros"]');
    ok('Mis números: cuenta el corte y deja fuera el tiempo de 1 min', await ver(bar, 'cortes esta semana') && await ver(bar, 'Aún no hay tiempos'));
    await foto(bar, '11-numeros');

    // 11. Al recargar, todo sigue ahí
    await bar.reload();
    ok('Barbero: después de recargar sigue la caja', await ver(bar, '10.000', 15000));

    // 12. Otra copia del barbero (por ejemplo Safari + ícono) no duplica llegadas
    const bar2 = await celular('barbero2');
    await bar2.goto(`${base}/index.html?b=${B}&emu=1`);
    await ver(bar2, 'Caja de hoy', 15000);
    await bar2.waitForTimeout(2500);
    const c5 = await celular('cliente3');
    await c5.goto(url.replace(/^https?:\/\/[^/]+/, base));
    await c5.fill('#nombre', 'Vicente Muñoz');
    await toca(c5, '[data-hora="0"]');
    await ver(c5, 'Listo', 15000);
    await bar.waitForTimeout(4000);
    const vic = await bar.evaluate(() => window.__E.citas.filter((c) => (window.__E.clientes[c.cl] || {}).n === 'Vicente Muñoz').length);
    ok('Dos copias abiertas: Vicente aparece una sola vez', vic === 1, `aparece ${vic} veces`);

    for (const p of [bar, c1, c2, bar2, c5]) ok(`Sin errores de JavaScript (${p.nombre})`, p.errores.length === 0, p.errores.slice(0, 3).join(' | '));
  } catch (e) { console.error(e); fallas++; }
  for (const b of navegadores) await b.close().catch(() => {});
  srv.close(); cerrarEmu();
  console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo bien');
  process.exit(fallas ? 1 : 0);
})();
