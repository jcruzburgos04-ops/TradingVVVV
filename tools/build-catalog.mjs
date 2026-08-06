#!/usr/bin/env node
/* LibreCharts — importador del universo completo de acciones de EE.UU.
 *
 * El catálogo que viene en js/catalog-us.js trae ~650 papeles seleccionados
 * (S&P 500, ETF, índices y ADR argentinos), suficiente para el uso diario.
 * Este script descarga los listados OFICIALES de NASDAQ Trader y genera
 * js/catalog-us-full.js con TODOS los símbolos listados en Nasdaq, NYSE,
 * NYSE American, NYSE ARCA, Cboe BZX e IEX (~8.000 en total).
 *
 * Uso:
 *   node tools/build-catalog.mjs
 *
 * Si tu red bloquea nasdaqtrader.com, bajá los dos archivos a mano y usá:
 *   node tools/build-catalog.mjs --dir ./descargas
 * (esperando encontrar ahí nasdaqlisted.txt y otherlisted.txt)
 *
 * No necesita dependencias: sólo Node 18 o superior. Volvé a ejecutarlo cada
 * tanto para incorporar altas y bajas del mercado.
 *
 * Nota: los nombres de las empresas vienen en inglés, tal como los publica
 * NASDAQ Trader. Los papeles que ya están en el catálogo seleccionado
 * conservan su nombre en español, porque ese archivo se carga primero. */

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'js', 'catalog-us-full.js');
const INDEX = join(ROOT, 'index.html');

const SOURCES = [
  { url: 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt', file: 'nasdaqlisted.txt', kind: 'nasdaq' },
  { url: 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt', file: 'otherlisted.txt', kind: 'other' }
];

const argDir = (() => {
  const i = process.argv.indexOf('--dir');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const EXCHANGES = {
  A: 'NYSE American',
  N: 'NYSE',
  P: 'NYSE ARCA',
  Z: 'Cboe BZX',
  V: 'IEX'
};

async function download(url) {
  process.stdout.write(`  descargando ${url} … `);
  const res = await fetch(url, { headers: { 'User-Agent': 'LibreCharts/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  console.log(`${(text.length / 1024).toFixed(0)} KB`);
  return text;
}

function parse(text, kind) {
  const lines = text.trim().split('\n');
  const header = lines.shift().split('|');
  const col = (name) => header.indexOf(name);

  const iSym = kind === 'nasdaq' ? col('Symbol') : col('ACT Symbol');
  const iName = col('Security Name');
  const iTest = col('Test Issue');
  const iEtf = col('ETF');
  const iExch = col('Exchange');

  const out = [];
  for (const line of lines) {
    if (line.startsWith('File Creation Time')) continue;
    const c = line.split('|');
    const sym = (c[iSym] || '').trim();
    if (!sym || c[iTest] === 'Y') continue;
    // Los símbolos con puntos o signos son clases y derechos que Yahoo
    // escribe con guion (BRK.B → BRK-B).
    const clean = sym.replace(/\./g, '-').toUpperCase();
    if (!/^[A-Z0-9-]{1,10}$/.test(clean)) continue;

    let name = (c[iName] || sym).trim();
    // "Apple Inc. - Common Stock" → "Apple Inc."
    name = name.replace(/\s*-\s*(Common Stock|Class [A-Z].*|Ordinary Shares.*|American Depositary Shares.*|Warrant.*|Unit.*|Right.*|Preferred.*|Depositary.*)$/i, '').trim();

    out.push({
      s: clean,
      n: name || clean,
      etf: c[iEtf] === 'Y',
      exch: kind === 'nasdaq' ? 'Nasdaq' : (EXCHANGES[c[iExch]] || 'NYSE')
    });
  }
  return out;
}

function render(items) {
  const rows = items
    .map((i) => `${i.s}|${i.n.replace(/[|\n\r]/g, ' ')}|${i.etf ? 'E' : 'S'}|${i.exch}`)
    .join('\n');

  return `/* LibreCharts — universo completo de acciones y ETF de EE.UU.
 *
 * GENERADO AUTOMÁTICAMENTE por tools/build-catalog.mjs — no editar a mano.
 * Fuente: listados oficiales de NASDAQ Trader (nasdaqlisted.txt / otherlisted.txt)
 * Símbolos: ${items.length}
 * Generado: ${new Date().toISOString().slice(0, 10)}
 */
(function () {
  'use strict';
  window.TV = window.TV || {};

  var ROWS = \`
${rows}
\`;

  var items = [];
  ROWS.trim().split('\\n').forEach(function (line) {
    var p = line.split('|');
    if (!p[0]) return;
    items.push({
      s: p[0], n: p[1] || p[0], mkt: 'us',
      type: p[2] === 'E' ? 'etf' : 'stock',
      ccy: 'USD', exch: p[3] || ''
    });
  });

  // Funciona tanto si este archivo se carga antes como después de catalog.js.
  if (TV.Catalog && TV.Catalog.add) TV.Catalog.add(items);
  else {
    TV.RawCatalog = TV.RawCatalog || [];
    Array.prototype.push.apply(TV.RawCatalog, items);
  }
})();
`;
}

async function patchIndex() {
  let html = await readFile(INDEX, 'utf8');
  if (html.includes('catalog-us-full.js')) return false;
  html = html.replace(
    '<script src="js/catalog-us.js"></script>',
    '<script src="js/catalog-us.js"></script>\n<script src="js/catalog-us-full.js"></script>'
  );
  await writeFile(INDEX, html);
  return true;
}

async function main() {
  console.log('LibreCharts — importando el universo completo de EE.UU.\n');

  const all = [];
  for (const src of SOURCES) {
    const text = argDir
      ? await readFile(join(argDir, src.file), 'utf8')
      : await download(src.url);
    const items = parse(text, src.kind);
    console.log(`  → ${items.length} símbolos (${src.kind})`);
    all.push(...items);
  }

  const seen = new Set();
  const unique = all.filter((i) => (seen.has(i.s) ? false : seen.add(i.s)));
  unique.sort((a, b) => (a.s < b.s ? -1 : 1));

  await writeFile(OUT, render(unique));
  console.log(`\n  escrito js/catalog-us-full.js con ${unique.length} símbolos`);

  const patched = await patchIndex();
  console.log(patched
    ? '  index.html actualizado: ya carga el catálogo completo'
    : '  index.html ya cargaba el catálogo completo');

  const byExch = unique.reduce((acc, i) => ((acc[i.exch] = (acc[i.exch] || 0) + 1), acc), {});
  console.log('\n  Por mercado:');
  Object.entries(byExch).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`    ${k.padEnd(14)} ${v}`));
  console.log('\nListo. Recargá la página para ver el catálogo completo.');
}

main().catch((e) => {
  console.error('\nError:', e.message);
  console.error('Si tu red bloquea nasdaqtrader.com, descargá a mano');
  console.error('nasdaqlisted.txt y otherlisted.txt y adaptá SOURCES a rutas locales.');
  process.exit(1);
});
