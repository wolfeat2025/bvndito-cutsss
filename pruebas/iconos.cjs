// Genera los íconos de la app (monograma BC en oro sobre negro) con un navegador de prueba.
// Uso: node pruebas/iconos.cjs   (usa el Playwright instalado en D:\CUADERNO_JUAN\pruebas)
const path = require('path');
const { chromium } = require('D:/CUADERNO_JUAN/pruebas/node_modules/playwright');

const html = (tam, conTexto) => `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap">
<style>html,body{margin:0;width:${tam}px;height:${tam}px;background:#000}
.c{position:absolute;inset:${tam * 0.07}px;border-radius:50%;border:${Math.max(1.5, tam * 0.006)}px solid #d9ad5b}
.m{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:${tam * 0.02}px}
.bc{font:600 ${tam * (conTexto ? 0.4 : 0.46)}px/0.9 "Cormorant Garamond",serif;letter-spacing:-.1em;padding-right:.1em;
 background:linear-gradient(135deg,#f6dc98 0%,#e0b55c 40%,#b8862f 72%,#efcd7d 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.l{width:${tam * 0.42}px;height:1px;background:#c99a48;position:relative}.l::after{content:"";position:absolute;left:50%;top:-1.5px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#e3bc6a}
.t{font:500 ${tam * 0.052}px/1 "Cormorant Garamond",serif;letter-spacing:.22em;color:#e3bc6a;padding-left:.22em}</style></head>
<body><div class="c"></div><div class="m"><div class="bc">BC</div>${conTexto ? '<div class="l"></div><div class="t">BVNDITO CUTSSS</div>' : ''}</div></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [nombre, tam, texto] of [['icon-512.png', 512, true], ['icon-192.png', 192, false], ['apple-touch-icon.png', 180, false]]) {
    await p.setViewportSize({ width: tam, height: tam });
    await p.setContent(html(tam, texto), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(__dirname, '..', 'iconos', nombre) });
    console.log('✓', nombre);
  }
  await b.close();
})();
