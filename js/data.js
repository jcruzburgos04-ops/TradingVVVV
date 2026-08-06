/* LibreCharts — capa de datos multi-mercado.
 *
 * Cada activo se enruta a la fuente que corresponde:
 *   cripto            → Binance (REST + WebSocket, sin clave)
 *   acciones/ETF/bonos→ Yahoo Finance (histórico OHLC; BYMA con sufijo .BA)
 *   respaldo EE.UU.   → Stooq (CSV diario)
 *   Argentina en vivo → data912 (API pública con precios de BYMA)
 *   sin red           → mercado sintético, para que la aplicación siga usable
 *
 * Todas las fuentes son públicas y sin clave. Si alguna está bloqueada por
 * CORS o por la red, se degrada a la siguiente y el estado lo informa arriba.
 * Se puede configurar un proxy CORS propio en Fuentes de datos. */
(function () {
  'use strict';
  window.TV = window.TV || {};

  var BINANCE_REST = 'https://api.binance.com/api/v3';
  var BINANCE_WS = 'wss://stream.binance.com:9443';
  var BYBIT_REST = 'https://api.bybit.com/v5/market';
  var BYBIT_WS = 'wss://stream.bybit.com/v5/public/';
  var YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';
  var STOOQ = 'https://stooq.com/q/d/l/';
  var DATA912 = 'https://data912.com';

  var INTERVAL_MS = {
    '1m': 60e3, '3m': 180e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3,
    '1h': 3600e3, '2h': 7200e3, '4h': 14400e3, '6h': 21600e3, '8h': 28800e3,
    '12h': 43200e3, '1d': 86400e3, '3d': 259200e3, '1w': 604800e3, '1M': 2592000e3,
    '3M': 7776000e3
  };

  // Cómo pedirle cada temporalidad a Yahoo. `agg` agrupa velas del lado del
  // cliente: Yahoo no sirve 4h, pero sí 60m, y 4h son cuatro de esas.
  var YH_MAP = {
    '1m': { i: '1m', r: '5d', agg: 1 },
    '3m': { i: '1m', r: '5d', agg: 3 },
    '5m': { i: '5m', r: '1mo', agg: 1 },
    '15m': { i: '15m', r: '1mo', agg: 1 },
    '30m': { i: '30m', r: '1mo', agg: 1 },
    '1h': { i: '60m', r: '2y', agg: 1 },
    '2h': { i: '60m', r: '2y', agg: 2 },
    '4h': { i: '60m', r: '2y', agg: 4 },
    '6h': { i: '60m', r: '2y', agg: 6 },
    '8h': { i: '60m', r: '2y', agg: 8 },
    '12h': { i: '60m', r: '2y', agg: 12 },
    '1d': { i: '1d', r: 'max', agg: 1 },
    '3d': { i: '1d', r: 'max', agg: 3 },
    '1w': { i: '1wk', r: 'max', agg: 1 },
    '1M': { i: '1mo', r: 'max', agg: 1 },
    '3M': { i: '3mo', r: 'max', agg: 1 }
  };

  // Temporalidades de Bybit. Las que no publica (8h, 3d) se arman agrupando.
  var BYBIT_MAP = {
    '1m': { i: '1', agg: 1 }, '3m': { i: '3', agg: 1 }, '5m': { i: '5', agg: 1 },
    '15m': { i: '15', agg: 1 }, '30m': { i: '30', agg: 1 }, '1h': { i: '60', agg: 1 },
    '2h': { i: '120', agg: 1 }, '4h': { i: '240', agg: 1 }, '6h': { i: '360', agg: 1 },
    '8h': { i: '240', agg: 2 }, '12h': { i: '720', agg: 1 }, '1d': { i: 'D', agg: 1 },
    '3d': { i: 'D', agg: 3 }, '1w': { i: 'W', agg: 1 }, '1M': { i: 'M', agg: 1 },
    '3M': { i: 'M', agg: 3 }
  };

  // preferCrypto: 'bybit' (por omisión, es donde opera el usuario) o 'binance'.
  // demo: NUNCA se activa solo. Sólo si el usuario lo enciende a mano para
  // probar la interfaz sin conexión. Inventar precios confunde: si una fuente
  // falla se informa el error, y si el mercado está cerrado el gráfico queda
  // quieto en la última vela real.
  var settings = { proxy: '', preferCrypto: 'bybit', demo: false };

  function applyProxy(url) {
    var p = settings.proxy;
    if (!p) return url;
    return p.indexOf('{url}') >= 0
      ? p.replace('{url}', encodeURIComponent(url))
      : p + url;
  }

  function getJSON(url) {
    return fetch(applyProxy(url), { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function getText(url) {
    return fetch(applyProxy(url), { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  // ---------- utilidades de velas ----------
  function aggregate(candles, n) {
    if (!n || n < 2) return candles;
    var out = [];
    for (var i = 0; i < candles.length; i += n) {
      var slice = candles.slice(i, i + n);
      if (!slice.length) break;
      var hi = -Infinity, lo = Infinity, vol = 0;
      slice.forEach(function (k) {
        if (k.high > hi) hi = k.high;
        if (k.low < lo) lo = k.low;
        vol += k.volume || 0;
      });
      out.push({
        time: slice[0].time, open: slice[0].open, high: hi, low: lo,
        close: slice[slice.length - 1].close, volume: vol
      });
    }
    return out;
  }

  function cleanCandles(list) {
    return list.filter(function (k) {
      return k && isFinite(k.open) && isFinite(k.high) && isFinite(k.low) && isFinite(k.close) && k.close > 0;
    });
  }

  // ---------- fuente: Binance (cripto) ----------
  var Binance = {
    id: 'binance',
    label: 'Binance',
    klines: function (desc, interval, opts) {
      opts = opts || {};
      var url = BINANCE_REST + '/klines?symbol=' + encodeURIComponent(desc.s) +
        '&interval=' + interval + '&limit=' + (opts.limit || 1000) +
        (opts.endTime ? '&endTime=' + opts.endTime : '');
      return getJSON(url).then(function (raw) {
        if (!Array.isArray(raw)) throw new Error('respuesta inválida');
        return raw.map(function (k) {
          return { time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
        });
      });
    }
  };

  // ---------- fuente: Bybit (cripto: perpetuos y spot) ----------
  // El usuario opera en Bybit, así que sus perpetuos son el precio que ve en
  // pantalla. Se prueba primero `linear` (perpetuo USDT) y luego `spot`.
  var Bybit = {
    id: 'bybit',
    label: 'Bybit',
    // En los perpetuos, las monedas de precio muy chico cotizan multiplicadas
    // por mil (SHIB → 1000SHIB). Se pide con ese nombre y se divide al leer.
    perpName: function (s) {
      return { SHIBUSDT: '1000SHIBUSDT', PEPEUSDT: '1000PEPEUSDT', BONKUSDT: '1000BONKUSDT' }[s] || s;
    },
    scaleOf: function (s, category) {
      return category === 'linear' && /^(SHIB|PEPE|BONK)USDT$/.test(s) ? 1000 : 1;
    },
    categoriesFor: function (desc) {
      return desc.bybitSpotOnly ? ['spot'] : ['linear', 'spot'];
    },
    fetchOne: function (desc, interval, category) {
      var m = BYBIT_MAP[interval] || BYBIT_MAP['1h'];
      var sym = category === 'linear' ? Bybit.perpName(desc.s) : desc.s;
      var scale = Bybit.scaleOf(desc.s, category);
      var url = BYBIT_REST + '/kline?category=' + category + '&symbol=' + encodeURIComponent(sym) +
        '&interval=' + m.i + '&limit=1000';
      return getJSON(url).then(function (j) {
        if (!j || j.retCode !== 0 || !j.result || !Array.isArray(j.result.list) || !j.result.list.length) {
          throw new Error(j && j.retMsg ? j.retMsg : 'sin datos');
        }
        // Bybit devuelve de la vela más nueva a la más vieja.
        var out = j.result.list.slice().reverse().map(function (k) {
          return {
            time: +k[0], open: +k[1] / scale, high: +k[2] / scale,
            low: +k[3] / scale, close: +k[4] / scale, volume: +k[5]
          };
        });
        return { candles: aggregate(cleanCandles(out), m.agg), category: category };
      });
    },
    klines: function (desc, interval) {
      var cats = Bybit.categoriesFor(desc);
      return cats.reduce(function (p, cat) {
        return p.catch(function () { return Bybit.fetchOne(desc, interval, cat); });
      }, Promise.reject(new Error('inicio')));
    }
  };

  // ---------- fuente: Yahoo Finance (acciones, ETF, bonos, índices) ----------
  var Yahoo = {
    id: 'yahoo',
    label: 'Yahoo Finance',
    ticker: function (desc) {
      return desc.yh || desc.s;
    },
    klines: function (desc, interval) {
      var m = YH_MAP[interval] || YH_MAP['1d'];
      var url = YAHOO + encodeURIComponent(Yahoo.ticker(desc)) +
        '?interval=' + m.i + '&range=' + m.r + '&includePrePost=false';
      return getJSON(url).then(function (j) {
        var res = j && j.chart && j.chart.result && j.chart.result[0];
        if (!res || !res.timestamp) throw new Error('sin datos');
        var q = res.indicators.quote[0];
        var out = [];
        for (var i = 0; i < res.timestamp.length; i++) {
          if (q.close[i] == null) continue;
          out.push({
            time: res.timestamp[i] * 1000,
            open: q.open[i] == null ? q.close[i] : q.open[i],
            high: q.high[i] == null ? q.close[i] : q.high[i],
            low: q.low[i] == null ? q.close[i] : q.low[i],
            close: q.close[i],
            volume: q.volume[i] || 0
          });
        }
        return aggregate(cleanCandles(out), m.agg);
      });
    }
  };

  // ---------- fuente: Stooq (respaldo diario para EE.UU.) ----------
  var Stooq = {
    id: 'stooq',
    label: 'Stooq',
    supports: function (desc, interval) {
      return desc.mkt === 'us' && ['1d', '3d', '1w', '1M', '3M'].indexOf(interval) >= 0 &&
        desc.type !== 'index' && desc.type !== 'fx';
    },
    klines: function (desc, interval) {
      var i = interval === '1w' ? 'w' : (interval === '1M' || interval === '3M') ? 'm' : 'd';
      var url = STOOQ + '?s=' + encodeURIComponent(desc.s.toLowerCase()) + '.us&i=' + i;
      return getText(url).then(function (csv) {
        var lines = csv.trim().split('\n');
        if (lines.length < 2) throw new Error('sin datos');
        var out = [];
        for (var n = 1; n < lines.length; n++) {
          var c = lines[n].split(',');
          if (c.length < 5) continue;
          out.push({
            time: Date.parse(c[0] + 'T00:00:00Z'),
            open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +(c[5] || 0)
          });
        }
        return aggregate(cleanCandles(out), interval === '3d' || interval === '3M' ? 3 : 1);
      });
    }
  };

  // ---------- fuente: data912 (precios en vivo de BYMA) ----------
  var AR_ENDPOINTS = [
    { path: '/live/arg_stocks', type: 'stock' },
    { path: '/live/arg_cedears', type: 'cedear' },
    { path: '/live/arg_bonds', type: 'bond' },
    { path: '/live/arg_corp', type: 'on' },
    { path: '/live/arg_notes', type: 'letra' }
  ];

  var Data912 = {
    id: 'data912',
    label: 'data912 (BYMA)',
    cache: {},        // símbolo → { px, pct, ts }
    lastFetch: 0,
    inflight: null,

    normalize: function (row) {
      if (!row) return null;
      var s = row.symbol || row.ticker || row.simbolo;
      if (!s) return null;
      var px = row.c != null ? row.c : (row.close != null ? row.close : row.last);
      var pct = row.pct_change != null ? row.pct_change : (row.variation != null ? row.variation : 0);
      if (px == null || !isFinite(px)) return null;
      return { s: String(s).toUpperCase(), px: +px, pct: +pct || 0, vol: +(row.v || row.q_op || 0) };
    },

    // Trae los cinco paneles y refresca la caché de precios.
    refresh: function () {
      var now = Date.now();
      if (this.inflight) return this.inflight;
      if (now - this.lastFetch < 5000) return Promise.resolve(this.cache);
      var self = this;
      this.inflight = Promise.all(AR_ENDPOINTS.map(function (ep) {
        return getJSON(DATA912 + ep.path)
          .then(function (rows) { return { ep: ep, rows: Array.isArray(rows) ? rows : [] }; })
          .catch(function () { return { ep: ep, rows: [] }; });
      })).then(function (packs) {
        var any = 0;
        packs.forEach(function (p) {
          p.rows.forEach(function (row) {
            var q = self.normalize(row);
            if (!q) return;
            self.cache[q.s] = { px: q.px, pct: q.pct, vol: q.vol, ts: Date.now(), type: p.ep.type };
            any++;
          });
        });
        self.lastFetch = Date.now();
        self.inflight = null;
        if (!any) throw new Error('data912 sin datos');
        return self.cache;
      }).catch(function (e) {
        self.inflight = null;
        throw e;
      });
      return this.inflight;
    },

    quote: function (symbol) {
      return this.cache[String(symbol).toUpperCase()] || null;
    }
  };

  // Descubre en vivo todo lo que cotiza hoy en BYMA y lo suma al catálogo:
  // letras, obligaciones negociables y emisiones nuevas que no están escritas
  // a mano en los catálogos estáticos.
  function discoverArgentina() {
    return Data912.refresh().then(function (cache) {
      var items = Object.keys(cache).map(function (s) {
        var c = cache[s];
        return {
          s: s, n: s, mkt: 'ar', type: c.type || 'stock',
          ccy: /D$/.test(s) || /C$/.test(s) ? 'USD' : 'ARS',
          yh: s + '.BA', live: true
        };
      });
      return TV.Catalog.add(items);
    });
  }

  // ---------- mercado sintético (sin conexión) ----------
  var DEMO_BASE = {
    BTC: 68000, ETH: 3300, BNB: 600, SOL: 150, XRP: 2.2, ADA: 0.62, DOGE: 0.16, AVAX: 28,
    DOT: 5.2, LINK: 15, POL: 0.42, LTC: 90, TRX: 0.24, SHIB: 0.000018, UNI: 8.5, ATOM: 5.4,
    XLM: 0.31, NEAR: 4.6, APT: 7.5, ARB: 0.65, OP: 1.5, FIL: 3.6, INJ: 20, SUI: 3.2,
    PEPE: 0.0000098, RENDER: 6.2, AAVE: 180, ALGO: 0.16, TON: 5.1, SAND: 0.3, MANA: 0.32,
    ICP: 8.4, VET: 0.028, HBAR: 0.1, EOS: 0.55, XTZ: 0.85, THETA: 1.3, GRT: 0.16,
    ETC: 22, BCH: 420, WLD: 1.9, SEI: 0.35, TIA: 5.5, JUP: 0.85, EUR: 1.08, USDT: 1, USDC: 1
  };
  var QUOTES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY'];

  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function demoBase(desc) {
    var symbol = desc.s || String(desc);
    if (desc.mkt === 'crypto') {
      var base = symbol, quote = 'USDT';
      for (var i = 0; i < QUOTES.length; i++) {
        var q = QUOTES[i];
        if (symbol.length > q.length && symbol.slice(-q.length) === q) {
          base = symbol.slice(0, -q.length);
          quote = q;
          break;
        }
      }
      var bp = DEMO_BASE[base];
      if (bp == null) bp = 0.5 + (hashCode(base) % 20000) / 100;
      return bp / (DEMO_BASE[quote] == null ? 1 : DEMO_BASE[quote]);
    }
    if (desc.mkt === 'ar') {
      // Bonos alrededor de la paridad; acciones y CEDEARs en pesos.
      if (desc.type === 'bond' || desc.type === 'bopreal') return desc.ccy === 'USD' ? 60 + hashCode(symbol) % 25 : 1200 + hashCode(symbol) % 900;
      if (desc.type === 'cer' || desc.type === 'dlk' || desc.type === 'letra') return 100 + hashCode(symbol) % 150;
      if (desc.type === 'on') return desc.ccy === 'USD' ? 95 + hashCode(symbol) % 12 : 900 + hashCode(symbol) % 400;
      if (desc.type === 'fx') return 1150 + hashCode(symbol) % 200;
      if (desc.type === 'index') return 1800000 + hashCode(symbol) % 200000;
      return 900 + hashCode(symbol) % 8000;
    }
    if (desc.type === 'index') return 4500 + hashCode(symbol) % 2000;
    if (desc.type === 'fx') return 1 + (hashCode(symbol) % 200) / 100;
    return 20 + hashCode(symbol) % 400;
  }

  function generateDemo(desc, interval, n) {
    var symbol = desc.s || String(desc);
    var rnd = mulberry32(hashCode(symbol));
    var base = demoBase(desc);
    var ms = INTERVAL_MS[interval] || 3600e3;
    var t0 = Math.floor(Date.now() / ms) * ms - (n - 1) * ms;
    var out = [], price = base, vol = 0.012;
    for (var i = 0; i < n; i++) {
      vol = Math.max(0.004, Math.min(0.04, vol + (rnd() - 0.5) * 0.003));
      var pull = Math.log(base / price) * 0.02;
      var drift = (rnd() - 0.5) * vol + pull;
      var open = price;
      var close = open * (1 + drift);
      var hi = Math.max(open, close) * (1 + rnd() * vol * 0.6);
      var lo = Math.min(open, close) * (1 - rnd() * vol * 0.6);
      var notional = 4e6 * (0.35 + rnd() + Math.abs(drift) * 40);
      out.push({
        time: t0 + i * ms, open: open, high: hi, low: lo, close: close,
        volume: notional / Math.max(close, 1e-9)
      });
      price = close;
    }
    return out;
  }

  // ---------- feed principal ----------
  function Feed() {
    this.demoMode = false;
    this.source = null;      // fuente que sirvió la última carga
    this.ws = null;
    this.wsTimer = null;
    this.demoTimer = null;
    this.pollTimer = null;
    this.retry = 0;
    this.onStatus = null;
  }

  Feed.prototype._status = function (s, label, market) {
    if (this.onStatus) this.onStatus(s, label, market);
  };

  // Serie derivada (MEP/CCL): cociente vela a vela de dos activos.
  Feed.prototype._loadDerived = function (desc, interval, limit) {
    var num = TV.Catalog.resolve('ar:' + desc.derived.num);
    var den = TV.Catalog.resolve('ar:' + desc.derived.den);
    if (!num || !den) return Promise.reject(new Error('faltan las patas del cociente'));
    var self = this;
    return Promise.all([
      Yahoo.klines(num, interval),
      Yahoo.klines(den, interval)
    ]).then(function (pair) {
      var byTime = {};
      pair[1].forEach(function (k) { byTime[k.time] = k; });
      var out = [];
      pair[0].forEach(function (a) {
        var b = byTime[a.time];
        if (!b || !b.close || !b.open) return;
        out.push({
          time: a.time,
          open: a.open / b.open,
          high: Math.max(a.high / b.high, a.open / b.open, a.close / b.close),
          low: Math.min(a.low / b.low, a.open / b.open, a.close / b.close),
          close: a.close / b.close,
          volume: 0
        });
      });
      if (!out.length) throw new Error('sin solapamiento entre las series');
      self.source = Yahoo;
      return out.slice(-limit);
    });
  };

  // Cadena de fuentes hasta que una responda; si ninguna, mercado sintético.
  Feed.prototype.load = function (desc, interval, limit) {
    var self = this;
    limit = limit || 1000;
    this._status('connecting');
    this.demoMode = false;

    var chain;
    if (desc.mkt === 'crypto') {
      var viaBybit = function () {
        return Bybit.klines(desc, interval).then(function (r) {
          self.source = Bybit;
          self.cryptoCategory = r.category;
          return r.candles.slice(-limit);
        });
      };
      var viaBinance = function () {
        return Binance.klines(desc, interval, { limit: limit }).then(function (c) {
          self.source = Binance;
          self.cryptoCategory = 'spot';
          return c;
        });
      };
      // Bybit primero si el usuario opera ahí; si no responde, Binance.
      chain = settings.preferCrypto === 'binance'
        ? [viaBinance, viaBybit]
        : [viaBybit, viaBinance];
    } else if (desc.derived) {
      chain = [function () { return self._loadDerived(desc, interval, limit); }];
    } else {
      chain = [function () {
        return Yahoo.klines(desc, interval).then(function (c) {
          self.source = Yahoo;
          return c.slice(-limit);
        });
      }];
      if (Stooq.supports(desc, interval)) {
        chain.push(function () {
          return Stooq.klines(desc, interval).then(function (c) {
            self.source = Stooq;
            return c.slice(-limit);
          });
        });
      }
    }

    if (settings.demo) {
      this.demoMode = true;
      this.source = { id: 'demo', label: 'simulado' };
      return Promise.resolve(generateDemo(desc, interval, limit));
    }

    return chain.reduce(function (p, step) {
      return p.catch(function () { return step(); });
    }, Promise.reject(new Error('inicio'))).then(function (candles) {
      if (!candles || candles.length < 2) throw new Error('la fuente no devolvió velas');
      self.demoMode = false;
      return candles;
    }).catch(function (e) {
      self.demoMode = false;
      self.source = null;
      self._status('err');
      // El error sube a la interfaz para explicarlo y ofrecer reintentar.
      throw new Error(motivo(desc, e));
    });
  };

  // Traduce el fallo técnico a algo accionable.
  function motivo(desc, e) {
    var m = (e && e.message) || 'error desconocido';
    if (/Failed to fetch|NetworkError|load failed/i.test(m)) {
      return 'No se pudo contactar la fuente de datos de ' + desc.s +
        '. Puede ser falta de conexión o que el navegador bloquee el pedido por CORS: ' +
        'probá configurar un proxy en Fuentes de datos.';
    }
    if (/HTTP 4\d\d/.test(m)) {
      return 'La fuente no reconoce el símbolo ' + desc.s + ' (' + m + '). ' +
        'Revisá el ticker o probá otro mercado.';
    }
    if (/HTTP 5\d\d/.test(m)) {
      return 'La fuente está caída en este momento (' + m + '). Probá de nuevo en un rato.';
    }
    return 'No se pudieron cargar los datos de ' + desc.s + ': ' + m;
  }

  Feed.prototype.loadOlder = function (desc, interval, beforeTime, limit) {
    // Cripto pagina hacia atrás; en acciones y bonos la primera carga ya trae
    // todo el histórico que publica la fuente.
    if (this.demoMode || desc.mkt !== 'crypto') return Promise.resolve([]);
    if (this.source === Bybit) {
      var m = BYBIT_MAP[interval] || BYBIT_MAP['1h'];
      var cat = this.cryptoCategory || 'linear';
      var sym = cat === 'linear' ? Bybit.perpName(desc.s) : desc.s;
      var scale = Bybit.scaleOf(desc.s, cat);
      var url = BYBIT_REST + '/kline?category=' + cat + '&symbol=' + encodeURIComponent(sym) +
        '&interval=' + m.i + '&limit=1000&end=' + (beforeTime - 1);
      return getJSON(url).then(function (j) {
        if (!j || j.retCode !== 0 || !j.result || !j.result.list) return [];
        var out = j.result.list.slice().reverse().map(function (k) {
          return {
            time: +k[0], open: +k[1] / scale, high: +k[2] / scale,
            low: +k[3] / scale, close: +k[4] / scale, volume: +k[5]
          };
        });
        return aggregate(cleanCandles(out), m.agg);
      }).catch(function () { return []; });
    }
    return Binance.klines(desc, interval, { limit: limit || 1000, endTime: beforeTime - 1 })
      .catch(function () { return []; });
  };

  // ---------- datos en vivo ----------
  Feed.prototype.openLive = function (desc, interval, onCandle) {
    this.closeLive();
    if (this.demoMode) { this._openDemoLive(desc, interval, onCandle); return; }

    // Mercado cerrado: no se sondea ni se simula nada. La última vela real se
    // queda como está y el estado lo informa. Se reintenta cerca de la apertura.
    var st = TV.Market ? TV.Market.status(desc) : { open: true };
    if (!st.open) {
      var self0 = this;
      this._status('closed', null, st);
      if (st.nextMs != null) {
        this.reopenTimer = setTimeout(function () {
          self0.openLive(desc, interval, onCandle);
        }, Math.min(st.nextMs + 2000, 3600000));
      }
      return;
    }

    if (desc.mkt === 'crypto') {
      if (this.source === Bybit) this._openBybitLive(desc, interval, onCandle);
      else this._openBinanceLive(desc, interval, onCandle);
      return;
    }
    this._openPollLive(desc, interval, onCandle);
  };

  Feed.prototype._openBybitLive = function (desc, interval, onCandle) {
    var self = this;
    var m = BYBIT_MAP[interval] || BYBIT_MAP['1h'];
    var cat = this.cryptoCategory || 'linear';

    // Las temporalidades que se arman agrupando (8h, 3d) no tienen un canal
    // propio: para esas se re-consulta el histórico cada tanto.
    if (m.agg > 1) {
      var poll = function () {
        Bybit.klines(desc, interval).then(function (r) {
          var last = r.candles[r.candles.length - 1];
          if (last) { self._status('live', Bybit.label); onCandle(last); }
        }).catch(function () { });
      };
      this._status('connecting');
      poll();
      this.pollTimer = setInterval(poll, 15000);
      return;
    }

    var sym = cat === 'linear' ? Bybit.perpName(desc.s) : desc.s;
    var scale = Bybit.scaleOf(desc.s, cat);
    var topic = 'kline.' + m.i + '.' + sym;
    this._status('connecting');

    function connect() {
      var ws;
      try { ws = new WebSocket(BYBIT_WS + cat); } catch (e) { self._openBinanceLive(desc, interval, onCandle); return; }
      self.ws = ws;
      ws.onopen = function () {
        self.retry = 0;
        ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
        self._status('live', Bybit.label);
        // Bybit cierra la conexión si no recibe señales de vida.
        self.pingTimer = setInterval(function () {
          if (ws.readyState === 1) ws.send(JSON.stringify({ op: 'ping' }));
        }, 20000);
      };
      ws.onmessage = function (ev) {
        try {
          var m2 = JSON.parse(ev.data);
          if (!m2.topic || m2.topic.indexOf('kline.') !== 0 || !m2.data) return;
          m2.data.forEach(function (k) {
            onCandle({
              time: +k.start, open: +k.open / scale, high: +k.high / scale,
              low: +k.low / scale, close: +k.close / scale, volume: +k.volume
            });
          });
        } catch (e) { /* mensaje no reconocido */ }
      };
      ws.onclose = function () {
        if (self.pingTimer) { clearInterval(self.pingTimer); self.pingTimer = null; }
        if (self.ws !== ws) return;
        self._status('connecting');
        self.wsTimer = setTimeout(connect, Math.min(30000, 1000 * Math.pow(2, self.retry++)));
      };
      ws.onerror = function () { try { ws.close(); } catch (e) { } };
    }
    connect();
  };

  Feed.prototype._openBinanceLive = function (desc, interval, onCandle) {
    var self = this;
    var url = BINANCE_WS + '/ws/' + desc.s.toLowerCase() + '@kline_' + interval;
    this._status('connecting');

    function connect() {
      var ws;
      try { ws = new WebSocket(url); } catch (e) { self._openPollLive(desc, interval, onCandle); return; }
      self.ws = ws;
      ws.onopen = function () { self.retry = 0; self._status('live', Binance.label); };
      ws.onmessage = function (ev) {
        try {
          var m = JSON.parse(ev.data);
          if (m.k) {
            onCandle({
              time: m.k.t, open: +m.k.o, high: +m.k.h, low: +m.k.l,
              close: +m.k.c, volume: +m.k.v
            });
          }
        } catch (e) { /* mensaje no reconocido */ }
      };
      ws.onclose = function () {
        if (self.ws !== ws) return;
        self._status('connecting');
        self.wsTimer = setTimeout(connect, Math.min(30000, 1000 * Math.pow(2, self.retry++)));
      };
      ws.onerror = function () { try { ws.close(); } catch (e) { } };
    }
    connect();
  };

  // Acciones y bonos: sondeo periódico de la última vela.
  Feed.prototype._openPollLive = function (desc, interval, onCandle) {
    var self = this;
    var ms = INTERVAL_MS[interval] || 3600e3;
    var useAr = desc.mkt === 'ar' && !desc.derived;
    var every = useAr ? 12000 : 20000;
    var fails = 0;

    function tick() {
      var p = useAr
        ? Data912.refresh().then(function () {
          var q = Data912.quote(desc.s);
          if (!q) throw new Error('sin cotización');
          return { px: q.px, vol: q.vol };
        })
        : Yahoo.klines(desc, interval).then(function (c) {
          var last = c[c.length - 1];
          if (!last) throw new Error('sin velas');
          return { candle: last };
        });

      p.then(function (r) {
        fails = 0;
        self._status('live', useAr ? Data912.label : Yahoo.label);
        if (r.candle) { onCandle(r.candle); return; }
        // data912 da precio puntual: se arma la vela en curso con él.
        var barT = Math.floor(Date.now() / ms) * ms;
        onCandle({ time: barT, open: r.px, high: r.px, low: r.px, close: r.px, volume: r.vol || 0 }, true);
      }).catch(function () {
        if (++fails >= 3) self._status('err');
      });
    }

    this._status('connecting');
    tick();
    this.pollTimer = setInterval(tick, every);
  };

  Feed.prototype._openDemoLive = function (desc, interval, onCandle) {
    var self = this;
    this._status('demo');
    var ms = INTERVAL_MS[interval] || 3600e3;
    var rnd = mulberry32(hashCode(desc.s) ^ 0x9e3779b9);
    var seed = this._demoSeed;
    var cur = seed ? {
      time: seed.time, open: seed.open, high: seed.high, low: seed.low,
      close: seed.close, volume: seed.volume
    } : null;

    this.demoTimer = setInterval(function () {
      var barT = Math.floor(Date.now() / ms) * ms;
      if (!cur) {
        var px = demoBase(desc);
        cur = { time: barT, open: px, high: px, low: px, close: px, volume: 0 };
      } else if (cur.time !== barT) {
        cur = { time: barT, open: cur.close, high: cur.close, low: cur.close, close: cur.close, volume: 0 };
      }
      var step = (rnd() - 0.5) * 0.0022 * cur.close;
      cur.close = Math.max(1e-12, cur.close + step);
      cur.high = Math.max(cur.high, cur.close);
      cur.low = Math.min(cur.low, cur.close);
      var ticksPerBar = Math.max(1, ms / 900);
      cur.volume += 4e6 / Math.max(cur.close, 1e-12) / ticksPerBar * (0.5 + rnd());
      onCandle({ time: cur.time, open: cur.open, high: cur.high, low: cur.low, close: cur.close, volume: cur.volume });
    }, 900);
  };

  Feed.prototype.seedDemoLive = function (lastCandle) { this._demoSeed = lastCandle; };

  Feed.prototype.closeLive = function () {
    if (this.reopenTimer) { clearTimeout(this.reopenTimer); this.reopenTimer = null; }
    if (this.ws) { var w = this.ws; this.ws = null; try { w.close(); } catch (e) { } }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.wsTimer) { clearTimeout(this.wsTimer); this.wsTimer = null; }
    if (this.demoTimer) { clearInterval(this.demoTimer); this.demoTimer = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  };

  // ---------- cotizaciones de la lista de seguimiento ----------
  function Tickers() {
    this.ws = null;
    this.timer = null;
    this.arTimer = null;
    this.usTimer = null;
    this.demo = false;
    this.onTick = null;      // (clave, precio, variación %)
    this._descs = [];
  }

  Tickers.prototype.watch = function (descs) {
    this.stop();
    this._descs = (descs || []).filter(Boolean);
    if (!this._descs.length) return;
    if (this.demo) { this._watchDemo(); return; }

    var self = this;
    function abierto(d) { return !TV.Market || TV.Market.status(d).open; }
    var crypto = this._descs.filter(function (d) { return d.mkt === 'crypto'; });
    // Sin cotizaciones nuevas fuera del horario: los últimos precios quedan fijos.
    var ar = this._descs.filter(function (d) { return d.mkt === 'ar' && !d.derived && abierto(d); });
    var us = this._descs.filter(function (d) { return d.mkt === 'us' && abierto(d); });

    if (crypto.length) this._watchCrypto(crypto);

    if (ar.length) {
      var pullAr = function () {
        Data912.refresh().then(function () {
          ar.forEach(function (d) {
            var q = Data912.quote(d.s);
            if (q && self.onTick) self.onTick(TV.Catalog.key(d), q.px, q.pct);
          });
        }).catch(function () { });
      };
      pullAr();
      this.arTimer = setInterval(pullAr, 15000);
    }

    if (us.length) {
      var idx = 0;
      var pullUs = function () {
        // De a uno para no golpear la fuente con toda la lista de una vez.
        var d = us[idx % us.length];
        idx++;
        Yahoo.klines(d, '1d').then(function (c) {
          var last = c[c.length - 1], prev = c[c.length - 2];
          if (!last || !self.onTick) return;
          var pct = prev && prev.close ? (last.close - prev.close) / prev.close * 100 : 0;
          self.onTick(TV.Catalog.key(d), last.close, pct);
        }).catch(function () { });
      };
      pullUs();
      this.usTimer = setInterval(pullUs, Math.max(4000, 20000 / Math.max(1, us.length)));
    }
  };

  Tickers.prototype._watchCrypto = function (descs) {
    if (settings.preferCrypto !== 'binance') this._watchBybit(descs);
    else this._watchBinance(descs);
  };

  // Cotizaciones de Bybit; si el canal no abre, se cae a Binance.
  Tickers.prototype._watchBybit = function (descs) {
    var self = this;
    var linear = descs.filter(function (d) { return !d.bybitSpotOnly; });
    if (!linear.length) { this._watchBinance(descs); return; }

    var byTopic = {};
    var args = linear.map(function (d) {
      var sym = Bybit.perpName(d.s);
      byTopic[sym] = { key: 'crypto:' + d.s, scale: Bybit.scaleOf(d.s, 'linear') };
      return 'tickers.' + sym;
    });

    var ws, got = false;
    try { ws = new WebSocket(BYBIT_WS + 'linear'); } catch (e) { this._watchBinance(descs); return; }
    this.ws = ws;
    ws.onopen = function () {
      ws.send(JSON.stringify({ op: 'subscribe', args: args }));
      self.pingTimer = setInterval(function () {
        if (ws.readyState === 1) ws.send(JSON.stringify({ op: 'ping' }));
      }, 20000);
    };
    ws.onmessage = function (ev) {
      try {
        var m = JSON.parse(ev.data);
        if (!m.topic || m.topic.indexOf('tickers.') !== 0 || !m.data) return;
        var info = byTopic[m.topic.slice(8)];
        if (!info || !self.onTick) return;
        var px = m.data.lastPrice != null ? +m.data.lastPrice : null;
        if (px == null || !isFinite(px)) return;
        got = true;
        var pct = m.data.price24hPcnt != null ? +m.data.price24hPcnt * 100 : 0;
        self.onTick(info.key, px / info.scale, pct);
      } catch (e) { }
    };
    ws.onerror = function () { try { ws.close(); } catch (e) { } };
    ws.onclose = function () {
      if (self.pingTimer) { clearInterval(self.pingTimer); self.pingTimer = null; }
      if (self.ws !== ws) return;
      self.ws = null;
      // Si nunca llegó un precio, la fuente no sirve en este navegador.
      if (!got) self._watchBinance(descs);
      else self.timer = setTimeout(function () { self.watch(self._descs); }, 5000);
    };
  };

  Tickers.prototype._watchBinance = function (descs) {
    var self = this;
    var streams = descs.map(function (d) { return d.s.toLowerCase() + '@miniTicker'; }).join('/');
    var ws;
    try { ws = new WebSocket(BINANCE_WS + '/stream?streams=' + streams); } catch (e) { return; }
    this.ws = ws;
    ws.onmessage = function (ev) {
      try {
        var m = JSON.parse(ev.data);
        var d = m.data;
        if (d && d.s && self.onTick) {
          var o = +d.o, c = +d.c;
          self.onTick('crypto:' + d.s, c, o ? (c - o) / o * 100 : 0);
        }
      } catch (e) { }
    };
    ws.onerror = function () { try { ws.close(); } catch (e) { } };
    ws.onclose = function () {
      if (self.ws !== ws) return;
      self.timer = setTimeout(function () { self.watch(self._descs); }, 5000);
    };
  };

  Tickers.prototype._watchDemo = function () {
    var self = this;
    var state = {};
    this._descs.forEach(function (d) {
      var rnd = mulberry32(hashCode(d.s) ^ 7);
      var px = demoBase(d);
      state[TV.Catalog.key(d)] = { px: px, open: px * (1 + (rnd() - 0.5) * 0.08), rnd: rnd };
    });
    this.timer = setInterval(function () {
      self._descs.forEach(function (d) {
        var k = TV.Catalog.key(d);
        var st = state[k];
        if (!st) return;
        st.px *= 1 + (st.rnd() - 0.5) * 0.002;
        if (self.onTick) self.onTick(k, st.px, (st.px - st.open) / st.open * 100);
      });
    }, 1500);
  };

  Tickers.prototype.stop = function () {
    if (this.ws) { var w = this.ws; this.ws = null; try { w.close(); } catch (e) { } }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    [this.timer, this.arTimer, this.usTimer].forEach(function (t) {
      if (t) { clearTimeout(t); clearInterval(t); }
    });
    this.timer = this.arTimer = this.usTimer = null;
  };

  TV.Data = {
    Feed: Feed,
    Tickers: Tickers,
    INTERVAL_MS: INTERVAL_MS,
    generateDemo: generateDemo,
    discoverArgentina: discoverArgentina,
    settings: settings,
    sources: { Bybit: Bybit, Binance: Binance, Yahoo: Yahoo, Stooq: Stooq, Data912: Data912 }
  };
})();
