/* LibreCharts — capa de datos.
 * Fuente principal: API pública de Binance (sin clave). Si no hay red,
 * se genera un mercado sintético para que la app siga funcionando. */
(function () {
  'use strict';
  window.TV = window.TV || {};

  var REST = 'https://api.binance.com/api/v3';
  var WS = 'wss://stream.binance.com:9443';

  var INTERVAL_MS = {
    '1m': 60e3, '3m': 180e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3,
    '1h': 3600e3, '2h': 7200e3, '4h': 14400e3, '6h': 21600e3, '8h': 28800e3,
    '12h': 43200e3, '1d': 86400e3, '3d': 259200e3, '1w': 604800e3, '1M': 2592000e3
  };

  var SYMBOLS = [
    ['BTCUSDT', 'Bitcoin'], ['ETHUSDT', 'Ethereum'], ['BNBUSDT', 'BNB'], ['SOLUSDT', 'Solana'],
    ['XRPUSDT', 'XRP'], ['ADAUSDT', 'Cardano'], ['DOGEUSDT', 'Dogecoin'], ['AVAXUSDT', 'Avalanche'],
    ['DOTUSDT', 'Polkadot'], ['LINKUSDT', 'Chainlink'], ['POLUSDT', 'Polygon'], ['LTCUSDT', 'Litecoin'],
    ['TRXUSDT', 'TRON'], ['SHIBUSDT', 'Shiba Inu'], ['UNIUSDT', 'Uniswap'], ['ATOMUSDT', 'Cosmos'],
    ['XLMUSDT', 'Stellar'], ['NEARUSDT', 'NEAR Protocol'], ['APTUSDT', 'Aptos'], ['ARBUSDT', 'Arbitrum'],
    ['OPUSDT', 'Optimism'], ['FILUSDT', 'Filecoin'], ['INJUSDT', 'Injective'], ['SUIUSDT', 'Sui'],
    ['PEPEUSDT', 'Pepe'], ['RENDERUSDT', 'Render'], ['AAVEUSDT', 'Aave'], ['ALGOUSDT', 'Algorand'],
    ['TONUSDT', 'Toncoin'], ['SANDUSDT', 'The Sandbox'], ['MANAUSDT', 'Decentraland'], ['ICPUSDT', 'Internet Computer'],
    ['VETUSDT', 'VeChain'], ['HBARUSDT', 'Hedera'], ['EOSUSDT', 'EOS'], ['XTZUSDT', 'Tezos'],
    ['THETAUSDT', 'Theta'], ['GRTUSDT', 'The Graph'], ['ETCUSDT', 'Ethereum Classic'], ['BCHUSDT', 'Bitcoin Cash'],
    ['WLDUSDT', 'Worldcoin'], ['SEIUSDT', 'Sei'], ['TIAUSDT', 'Celestia'], ['JUPUSDT', 'Jupiter'],
    ['ETHBTC', 'Ethereum / Bitcoin'], ['BNBBTC', 'BNB / Bitcoin'], ['SOLBTC', 'Solana / Bitcoin'], ['EURUSDT', 'Euro / USDT']
  ];

  // ---------- modo demo (sin conexión) ----------
  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
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

  // Precios de referencia por activo para que el modo demo sea creíble.
  var DEMO_BASE = {
    BTC: 68000, ETH: 3300, BNB: 600, SOL: 150, XRP: 2.2, ADA: 0.62, DOGE: 0.16, AVAX: 28,
    DOT: 5.2, LINK: 15, POL: 0.42, LTC: 90, TRX: 0.24, SHIB: 0.000018, UNI: 8.5, ATOM: 5.4,
    XLM: 0.31, NEAR: 4.6, APT: 7.5, ARB: 0.65, OP: 1.5, FIL: 3.6, INJ: 20, SUI: 3.2,
    PEPE: 0.0000098, RENDER: 6.2, AAVE: 180, ALGO: 0.16, TON: 5.1, SAND: 0.3, MANA: 0.32,
    ICP: 8.4, VET: 0.028, HBAR: 0.1, EOS: 0.55, XTZ: 0.85, THETA: 1.3, GRT: 0.16,
    ETC: 22, BCH: 420, WLD: 1.9, SEI: 0.35, TIA: 5.5, JUP: 0.85, EUR: 1.08, USDT: 1, USDC: 1
  };
  var QUOTES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY'];

  function demoBase(symbol) {
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
    var qp = DEMO_BASE[quote];
    if (qp == null) qp = 1;
    return bp / qp;
  }

  function generateDemo(symbol, interval, n) {
    var rnd = mulberry32(hashCode(symbol));
    var base = demoBase(symbol);
    var ms = INTERVAL_MS[interval] || 3600e3;
    var t0 = Math.floor(Date.now() / ms) * ms - (n - 1) * ms;
    var out = [], price = base, vol = 0.012;
    for (var i = 0; i < n; i++) {
      vol = Math.max(0.004, Math.min(0.04, vol + (rnd() - 0.5) * 0.003));
      // Paseo aleatorio con reversión suave a la media: el precio no se desboca.
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

  function parseKlines(raw) {
    return raw.map(function (k) {
      return { time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
    });
  }

  // ---------- feed principal ----------
  function Feed() {
    this.demoMode = false;
    this.ws = null;
    this.wsTimer = null;
    this.demoTimer = null;
    this.pollTimer = null;
    this.retry = 0;
    this.onStatus = null; // 'live' | 'demo' | 'connecting' | 'err'
  }

  Feed.prototype._status = function (s) { if (this.onStatus) this.onStatus(s); };

  Feed.prototype.fetchKlines = function (symbol, interval, opts) {
    var self = this;
    opts = opts || {};
    var url = REST + '/klines?symbol=' + encodeURIComponent(symbol) +
      '&interval=' + interval + '&limit=' + (opts.limit || 1000) +
      (opts.endTime ? '&endTime=' + opts.endTime : '');
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (raw) {
      if (!Array.isArray(raw)) throw new Error('respuesta inválida');
      self.demoMode = false;
      return parseKlines(raw);
    });
  };

  // Carga inicial: intenta Binance; si falla, activa el modo demo.
  Feed.prototype.load = function (symbol, interval, limit) {
    var self = this;
    this._status('connecting');
    return this.fetchKlines(symbol, interval, { limit: limit || 1000 }).catch(function (e) {
      console.warn('Sin conexión con Binance, usando datos de demostración:', e.message);
      self.demoMode = true;
      return generateDemo(symbol, interval, limit || 1000);
    });
  };

  Feed.prototype.loadOlder = function (symbol, interval, beforeTime, limit) {
    if (this.demoMode) return Promise.resolve([]);
    return this.fetchKlines(symbol, interval, { limit: limit || 1000, endTime: beforeTime - 1 })
      .catch(function () { return []; });
  };

  // ---------- datos en vivo ----------
  Feed.prototype.openLive = function (symbol, interval, onCandle) {
    var self = this;
    this.closeLive();
    if (this.demoMode) { this._openDemoLive(symbol, interval, onCandle); return; }

    var url = WS + '/ws/' + symbol.toLowerCase() + '@kline_' + interval;
    this._status('connecting');

    function connect() {
      var ws;
      try { ws = new WebSocket(url); } catch (e) { fallback(); return; }
      self.ws = ws;
      ws.onopen = function () { self.retry = 0; self._status('live'); };
      ws.onmessage = function (ev) {
        try {
          var m = JSON.parse(ev.data);
          if (m.k) {
            onCandle({
              time: m.k.t, open: +m.k.o, high: +m.k.h, low: +m.k.l,
              close: +m.k.c, volume: +m.k.v
            }, m.k.x === true);
          }
        } catch (e) { /* mensaje no reconocido */ }
      };
      ws.onclose = function () {
        if (self.ws !== ws) return; // cierre intencional
        self._status('connecting');
        var delay = Math.min(30000, 1000 * Math.pow(2, self.retry++));
        self.wsTimer = setTimeout(connect, delay);
      };
      ws.onerror = function () { try { ws.close(); } catch (e) { } };
    }

    function fallback() {
      // Sin WebSocket: sondeo REST ligero.
      self._status('live');
      self.pollTimer = setInterval(function () {
        self.fetchKlines(symbol, interval, { limit: 2 }).then(function (ks) {
          ks.forEach(function (k) { onCandle(k, false); });
        }).catch(function () { });
      }, 10000);
    }

    connect();
  };

  Feed.prototype._openDemoLive = function (symbol, interval, onCandle) {
    var self = this;
    this._status('demo');
    var ms = INTERVAL_MS[interval] || 3600e3;
    var rnd = mulberry32(hashCode(symbol) ^ 0x9e3779b9);
    var seed = this._demoSeed;
    var cur = seed ? {
      time: seed.time, open: seed.open, high: seed.high, low: seed.low,
      close: seed.close, volume: seed.volume
    } : null;

    this.demoTimer = setInterval(function () {
      var barT = Math.floor(Date.now() / ms) * ms;
      if (!cur) {
        var px = demoBase(symbol);
        cur = { time: barT, open: px, high: px, low: px, close: px, volume: 0 };
      } else if (cur.time !== barT) {
        cur = { time: barT, open: cur.close, high: cur.close, low: cur.close, close: cur.close, volume: 0 };
      }
      var step = (rnd() - 0.5) * 0.0022 * cur.close;
      cur.close = Math.max(1e-12, cur.close + step);
      cur.high = Math.max(cur.high, cur.close);
      cur.low = Math.min(cur.low, cur.close);
      // Reparte el volumen típico de una vela entre los ticks que caben en ella,
      // para que la barra en curso quede a la misma escala que el histórico.
      var ticksPerBar = Math.max(1, ms / 900);
      cur.volume += 4e6 / Math.max(cur.close, 1e-12) / ticksPerBar * (0.5 + rnd());
      onCandle({ time: cur.time, open: cur.open, high: cur.high, low: cur.low, close: cur.close, volume: cur.volume }, false);
    }, 900);
  };

  Feed.prototype.seedDemoLive = function (lastCandle) { this._demoSeed = lastCandle; };

  Feed.prototype.closeLive = function () {
    if (this.ws) { var w = this.ws; this.ws = null; try { w.close(); } catch (e) { } }
    if (this.wsTimer) { clearTimeout(this.wsTimer); this.wsTimer = null; }
    if (this.demoTimer) { clearInterval(this.demoTimer); this.demoTimer = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  };

  // ---------- ticker de la lista de seguimiento ----------
  function Tickers() {
    this.ws = null;
    this.timer = null;
    this.demo = false;
    this.onTick = null; // (symbol, price, pct24h)
    this._symbols = [];
  }

  Tickers.prototype.watch = function (symbols) {
    this._symbols = symbols.slice();
    this.stop();
    if (!symbols.length) return;
    var self = this;

    if (this.demo) { this._watchDemo(); return; }

    var streams = symbols.map(function (s) { return s.toLowerCase() + '@miniTicker'; }).join('/');
    var ws;
    try { ws = new WebSocket(WS + '/stream?streams=' + streams); } catch (e) { this.demo = true; this._watchDemo(); return; }
    this.ws = ws;
    ws.onmessage = function (ev) {
      try {
        var m = JSON.parse(ev.data);
        var d = m.data;
        if (d && d.s && self.onTick) {
          var o = +d.o, c = +d.c;
          self.onTick(d.s, c, o ? (c - o) / o * 100 : 0);
        }
      } catch (e) { }
    };
    ws.onerror = function () { try { ws.close(); } catch (e) { } };
    ws.onclose = function () {
      if (self.ws !== ws) return;
      self.timer = setTimeout(function () { self.watch(self._symbols); }, 5000);
    };
  };

  Tickers.prototype._watchDemo = function () {
    var self = this;
    var state = {};
    this._symbols.forEach(function (s) {
      var rnd = mulberry32(hashCode(s) ^ 7);
      var px = demoBase(s);
      // "Apertura" fija de la sesión: así el % del día se mueve poco a poco
      // en lugar de saltar en cada tick.
      state[s] = { px: px, open: px * (1 + (rnd() - 0.5) * 0.08), rnd: rnd };
    });
    this.timer = setInterval(function () {
      self._symbols.forEach(function (s) {
        var st = state[s];
        if (!st) return;
        st.px *= 1 + (st.rnd() - 0.5) * 0.002;
        if (self.onTick) self.onTick(s, st.px, (st.px - st.open) / st.open * 100);
      });
    }, 1500);
  };

  Tickers.prototype.stop = function () {
    if (this.ws) { var w = this.ws; this.ws = null; try { w.close(); } catch (e) { } }
    if (this.timer) { clearTimeout(this.timer); clearInterval(this.timer); this.timer = null; }
  };

  TV.Data = {
    Feed: Feed,
    Tickers: Tickers,
    SYMBOLS: SYMBOLS,
    INTERVAL_MS: INTERVAL_MS,
    generateDemo: generateDemo,
    demoBase: demoBase
  };
})();
