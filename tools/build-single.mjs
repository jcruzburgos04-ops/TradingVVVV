#!/usr/bin/env node
/* LibreCharts — empaquetador a un solo archivo.
 *
 * Junta index.html, el CSS y todos los scripts en un único .html que se puede
 * abrir con doble clic, mandar por mail o subir a cualquier hosting sin
 * carpetas. No minifica nada: el archivo sigue siendo legible.
 *
 * Uso:
 *   node tools/build-single.mjs              → dist/librecharts.html
 *   node tools/build-single.mjs --artifact   → dist/librecharts-artifact.html
 *
 * La variante --artifact omite <!DOCTYPE>, <html>, <head> y <body> porque el
 * servicio que la publica agrega ese esqueleto por su cuenta. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const artifact = process.argv.includes('--artifact');

async function main() {
  let html = await readFile(join(ROOT, 'index.html'), 'utf8');

  // CSS embebido
  // Ojo: el reemplazo se pasa como función a propósito. Con un string, JS
  // interpreta $&, $' y $` dentro del contenido — y el código tiene cosas como
  // return '$' para el peso, que romperían el archivo generado.
  const cssMatch = html.match(/<link rel="stylesheet" href="([^"]+)">/);
  if (cssMatch) {
    const css = await readFile(join(ROOT, cssMatch[1]), 'utf8');
    html = html.replace(cssMatch[0], () => `<style>\n${css}\n</style>`);
  }

  // Scripts embebidos, en el mismo orden en el que estaban
  const scriptRe = /<script src="([^"]+)"><\/script>\s*/g;
  const sources = [];
  let m;
  while ((m = scriptRe.exec(html)) !== null) sources.push(m[1]);

  let bundle = '';
  for (const src of sources) {
    const code = await readFile(join(ROOT, src), 'utf8');
    bundle += `\n/* ===== ${src} ===== */\n${code}\n`;
  }
  html = html.replace(scriptRe, '');
  html = html.replace('</body>', () => `<script>\n${bundle}\n</script>\n</body>`);

  if (artifact) {
    // Sólo el contenido: el esqueleto lo pone el servicio de publicación.
    const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'LibreCharts'])[1];
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);

    // El visor del artefacto marca el tema en <html data-theme>. La aplicación
    // usa una clase en <body>, así que se puentean: arranca con el tema del
    // visor y lo sigue si el lector lo cambia desde afuera.
    const themeBridge = `<script>
(function () {
  function hostTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  function apply(t) {
    document.body.className = 'theme-' + t;
    if (window.App && window.App.chart) {
      window.App.state.theme = t;
      window.App.chart.setTheme(t);
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.body.className = 'theme-' + hostTheme();
    setTimeout(function () { apply(hostTheme()); }, 400);
    new MutationObserver(function () { apply(hostTheme()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  });
})();
</script>`;

    html = `<title>${title}</title>\n` + themeBridge + '\n' + (bodyMatch ? bodyMatch[1] : html);
  }

  await mkdir(join(ROOT, 'dist'), { recursive: true });
  const out = join(ROOT, 'dist', artifact ? 'librecharts-artifact.html' : 'librecharts.html');
  await writeFile(out, html);

  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`Escrito ${out.replace(ROOT + '/', '')} — ${kb} KB, ${sources.length} scripts embebidos`);
  if (!artifact) console.log('Abrilo con doble clic: no necesita servidor ni conexión para arrancar.');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
