/* LibreCharts — índice de activos.
 * Une los catálogos estáticos (cripto, EE.UU., Argentina) con lo que se
 * descubre en vivo, y ofrece búsqueda y resolución de símbolos.
 *
 * Clave de un activo: "mercado:símbolo" (us:AAPL, ar:AAPL, crypto:BTCUSDT),
 * porque el mismo ticker existe en varios mercados: AAPL es acción en Nasdaq
 * y CEDEAR en BYMA, y no son el mismo instrumento ni la misma moneda. */
(function () {
  'use strict';
  window.TV = window.TV || {};

  var MARKETS = [
    { id: 'all', label: 'Todos' },
    { id: 'ar', label: 'Argentina' },
    { id: 'us', label: 'EE.UU.' },
    { id: 'crypto', label: 'Cripto' }
  ];

  var TYPES = {
    stock: 'Acción',
    adr: 'ADR',
    cedear: 'CEDEAR',
    etf: 'ETF',
    index: 'Índice',
    fx: 'Divisa',
    crypto: 'Cripto',
    bond: 'Bono soberano',
    bopreal: 'BOPREAL',
    cer: 'Bono CER',
    dlk: 'Dollar-linked',
    on: 'Obligación negociable',
    letra: 'Letra',
    prov: 'Bono provincial'
  };

  // Filtros rápidos por tipo dentro de un mercado.
  var AR_GROUPS = [
    { id: 'stock', label: 'Acciones' },
    { id: 'cedear', label: 'CEDEARs' },
    { id: 'bond', label: 'Bonos' },
    { id: 'letra', label: 'Letras' },
    { id: 'on', label: 'ONs' }
  ];

  var byKey = {};
  var list = [];

  function key(d) { return d.mkt + ':' + d.s; }

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function add(items) {
    var added = 0;
    (items || []).forEach(function (d) {
      if (!d || !d.s) return;
      var k = key(d);
      if (byKey[k]) {
        // Un activo descubierto en vivo completa al estático, no lo pisa.
        var cur = byKey[k];
        if (d.n && (!cur.n || cur.n === cur.s)) cur.n = d.n;
        if (d.live) cur.live = true;
        return;
      }
      d._q = norm(d.s) + ' ' + norm(d.n);
      byKey[k] = d;
      list.push(d);
      added++;
    });
    return added;
  }

  function get(k) { return byKey[k] || null; }

  // Texto libre → activo. Acepta "AAPL", "us:AAPL", "ar:AL30" o "GGAL.BA".
  function resolve(text, preferMkt) {
    if (!text) return null;
    var t = String(text).trim();
    if (byKey[t]) return byKey[t];

    var m = /^([a-z]+):(.+)$/i.exec(t);
    if (m) {
      var direct = byKey[m[1].toLowerCase() + ':' + m[2].toUpperCase()];
      if (direct) return direct;
      t = m[2];
    }
    var up = t.toUpperCase();
    if (/\.BA$/.test(up)) up = up.replace(/\.BA$/, '');

    var order = preferMkt ? [preferMkt, 'ar', 'us', 'crypto'] : ['crypto', 'us', 'ar'];
    for (var i = 0; i < order.length; i++) {
      var hit = byKey[order[i] + ':' + up];
      if (hit) return hit;
    }
    return null;
  }

  // Activo improvisado para un ticker que no está en el catálogo.
  function improvise(text, mkt, preferMkt) {
    var up = String(text || '').trim().toUpperCase();
    if (!up) return null;
    var guessed = mkt;
    if (!guessed) {
      if (/(USDT|BUSD|USDC|BTC|ETH)$/.test(up) && up.length >= 6) guessed = 'crypto';
      else if (/\.BA$/.test(up)) { guessed = 'ar'; up = up.replace(/\.BA$/, ''); }
      else guessed = (preferMkt === 'ar' || preferMkt === 'us') ? preferMkt : 'us';
    }
    var d = {
      s: up, n: up, mkt: guessed, type: guessed === 'crypto' ? 'crypto' : 'stock',
      ccy: guessed === 'ar' ? 'ARS' : (guessed === 'crypto' ? 'USDT' : 'USD'),
      custom: true
    };
    if (guessed === 'ar') d.yh = up + '.BA';
    add([d]);
    return byKey[key(d)];
  }

  function search(q, mkt, type, limit) {
    limit = limit || 80;
    var nq = norm(q);
    var out = [];

    for (var i = 0; i < list.length && out.length < 4000; i++) {
      var d = list[i];
      if (mkt && mkt !== 'all' && d.mkt !== mkt) continue;
      if (type && type !== 'all') {
        if (type === 'bond') {
          if (['bond', 'bopreal', 'cer', 'dlk', 'prov'].indexOf(d.type) < 0) continue;
        } else if (d.type !== type) continue;
      }
      if (!nq) { out.push({ d: d, r: 50 }); continue; }

      var ns = norm(d.s), nn = norm(d.n);
      var r = -1;
      if (ns === nq) r = 0;
      else if (ns.indexOf(nq) === 0) r = 1;
      else if (nn.indexOf(nq) === 0) r = 2;
      else if (ns.indexOf(nq) >= 0) r = 3;
      else if (nn.indexOf(nq) >= 0) r = 4;
      if (r >= 0) out.push({ d: d, r: r });
    }

    out.sort(function (a, b) {
      if (a.r !== b.r) return a.r - b.r;
      // A igualdad, primero lo más líquido/relevante: mercado local y cripto
      // antes que el largo listado de EE.UU., y ticker más corto primero.
      var pa = order(a.d), pb = order(b.d);
      if (pa !== pb) return pa - pb;
      if (a.d.s.length !== b.d.s.length) return a.d.s.length - b.d.s.length;
      return a.d.s < b.d.s ? -1 : 1;
    });
    return out.slice(0, limit).map(function (x) { return x.d; });
  }

  function order(d) {
    if (d.mkt === 'crypto') return 1;
    if (d.mkt === 'ar') return d.type === 'cedear' ? 3 : 2;
    return d.type === 'index' || d.type === 'etf' ? 4 : 5;
  }

  function stats() {
    var by = {};
    list.forEach(function (d) {
      by[d.mkt] = (by[d.mkt] || 0) + 1;
      by[d.mkt + '.' + d.type] = (by[d.mkt + '.' + d.type] || 0) + 1;
    });
    by.total = list.length;
    return by;
  }

  TV.Catalog = {
    MARKETS: MARKETS,
    TYPES: TYPES,
    AR_GROUPS: AR_GROUPS,
    add: add,
    get: get,
    key: key,
    resolve: resolve,
    improvise: improvise,
    search: search,
    stats: stats,
    all: function () { return list; },
    typeLabel: function (d) { return TYPES[d.type] || d.type; }
  };

  add(TV.RawCatalog || []);
  TV.RawCatalog = null; // ya está indexado
})();
