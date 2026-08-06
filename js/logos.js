/* LibreCharts — íconos circulares de los activos.
 *
 * No se descargan imágenes de terceros: cada ícono se dibuja en SVG dentro de
 * la propia página, así funciona sin conexión y sin depender de ningún CDN.
 * Las criptomonedas conocidas usan su color de marca y su símbolo; el resto
 * de los activos usan un monograma con un color estable derivado del ticker.
 * Encima se apoya la banderita del mercado, como en las plataformas de bolsa.
 *
 * Si preferís logos reales, en Fuentes de datos podés indicar un proveedor de
 * imágenes con {s} como marcador (por ejemplo https://misvg.example/{s}.png).
 * Queda desactivado por omisión para no romper el uso sin conexión. */
(function () {
  'use strict';
  window.TV = window.TV || {};

  var provider = '';

  // Colores de marca de las criptomonedas más operadas.
  var CRYPTO = {
    BTC: { c: '#f7931a', t: '₿' },
    ETH: { c: '#627eea', t: 'Ξ' },
    BNB: { c: '#f3ba2f', t: 'B' },
    SOL: { c: '#9945ff', t: 'S' },
    XRP: { c: '#23292f', t: 'X' },
    ADA: { c: '#0033ad', t: 'A' },
    DOGE: { c: '#c2a633', t: 'D' },
    AVAX: { c: '#e84142', t: 'A' },
    DOT: { c: '#e6007a', t: 'D' },
    LINK: { c: '#2a5ada', t: 'L' },
    POL: { c: '#8247e5', t: 'P' },
    LTC: { c: '#345d9d', t: 'Ł' },
    TRX: { c: '#eb0029', t: 'T' },
    SHIB: { c: '#ffa409', t: 'S' },
    UNI: { c: '#ff007a', t: 'U' },
    ATOM: { c: '#2e3148', t: 'A' },
    XLM: { c: '#08b5e5', t: '*' },
    NEAR: { c: '#00c08b', t: 'N' },
    APT: { c: '#06b6d4', t: 'A' },
    ARB: { c: '#12aaff', t: 'A' },
    OP: { c: '#ff0420', t: 'O' },
    FIL: { c: '#0090ff', t: 'F' },
    INJ: { c: '#00a2ff', t: 'I' },
    SUI: { c: '#4da2ff', t: 'S' },
    PEPE: { c: '#3d8130', t: 'P' },
    RENDER: { c: '#ff5a2d', t: 'R' },
    AAVE: { c: '#b6509e', t: 'A' },
    ALGO: { c: '#000000', t: 'A' },
    TON: { c: '#0098ea', t: 'T' },
    SAND: { c: '#00aeff', t: 'S' },
    MANA: { c: '#ff2d55', t: 'M' },
    ICP: { c: '#3b00b9', t: 'I' },
    VET: { c: '#15bdff', t: 'V' },
    HBAR: { c: '#000000', t: 'H' },
    EOS: { c: '#443f54', t: 'E' },
    XTZ: { c: '#2c7df7', t: 'T' },
    THETA: { c: '#2ab8e6', t: 'Θ' },
    GRT: { c: '#6f4cff', t: 'G' },
    ETC: { c: '#328332', t: 'Ξ' },
    BCH: { c: '#0ac18e', t: 'B' },
    WLD: { c: '#000000', t: 'W' },
    SEI: { c: '#9c1c1c', t: 'S' },
    TIA: { c: '#7b2bf9', t: 'T' },
    JUP: { c: '#c7f284', t: 'J' },
    USDT: { c: '#26a17b', t: '₮' },
    USDC: { c: '#2775ca', t: '$' },
    EUR: { c: '#003399', t: '€' }
  };

  // Colores de marca de empresas muy reconocibles.
  var BRAND = {
    AAPL: '#a2aaad', MSFT: '#00a4ef', GOOGL: '#4285f4', GOOG: '#4285f4',
    AMZN: '#ff9900', META: '#0866ff', TSLA: '#cc0000', NVDA: '#76b900',
    NFLX: '#e50914', KO: '#f40009', PEP: '#004b93', MCD: '#ffc72c',
    SBUX: '#00704a', NKE: '#111111', DIS: '#113ccf', INTC: '#0068b5',
    AMD: '#ed1c24', IBM: '#0530ad', ORCL: '#c74634', CRM: '#00a1e0',
    ADBE: '#ff0000', PYPL: '#003087', V: '#1a1f71', MA: '#eb001b',
    JPM: '#5c2d91', BAC: '#e31837', WMT: '#0071ce', HD: '#f96302',
    XOM: '#ee1c25', CVX: '#0054a4', BA: '#0039a6', T: '#00a8e0',
    VZ: '#ee0000', UBER: '#000000', ABNB: '#ff5a5f', SPOT: '#1db954',
    MELI: '#ffe600', GLOB: '#4c1d95', YPF: '#0a4a9e', YPFD: '#0a4a9e',
    GGAL: '#f47b20', PAMP: '#00a0df', PAM: '#00a0df', BMA: '#00539f',
    TECO2: '#00b2e3', ALUA: '#0f6cbd', TXAR: '#1f4e79', LOMA: '#c8102e',
    CEPU: '#e4002b', EDN: '#f7a800', BYMA: '#1b3a6b', SUPV: '#e30613',
    SPY: '#1b7ac2', QQQ: '#00b0f0', DIA: '#1f4e79', IWM: '#7b1fa2'
  };

  var PALETTE = ['#2962ff', '#26a69a', '#ff6d00', '#ab47bc', '#26c6da', '#66bb6a',
    '#ef5350', '#5c6bc0', '#ec407a', '#ffa726', '#8d6e63', '#29b6f6'];

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // Contraste suficiente para elegir texto blanco o negro sobre el color.
  function fgFor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    var n = parseInt(m[1], 16);
    var lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    return lum > 165 ? '#111820' : '#ffffff';
  }

  function cryptoBase(sym) {
    var quotes = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'BTC', 'ETH', 'BNB'];
    for (var i = 0; i < quotes.length; i++) {
      var q = quotes[i];
      if (sym.length > q.length && sym.slice(-q.length) === q) return sym.slice(0, -q.length);
    }
    return sym;
  }

  function monogram(s) {
    var t = String(s).replace(/[^A-Za-z0-9]/g, '');
    if (!t) return '?';
    if (t.length <= 2) return t.toUpperCase();
    // Dos letras leen mejor que tres en un círculo chico.
    return t.slice(0, 2).toUpperCase();
  }

  // Devuelve { bg, fg, text } con el aspecto del ícono.
  function face(d) {
    if (!d) return { bg: '#787b86', fg: '#fff', text: '?' };
    if (d.mkt === 'crypto') {
      var base = cryptoBase(d.s);
      var c = CRYPTO[base];
      if (c) return { bg: c.c, fg: fgFor(c.c), text: c.t };
      return { bg: PALETTE[hash(base) % PALETTE.length], fg: '#fff', text: monogram(base) };
    }
    var brand = BRAND[d.s];
    if (brand) return { bg: brand, fg: fgFor(brand), text: monogram(d.s) };

    // Los instrumentos de renta fija comparten una identidad visual por familia.
    if (d.type === 'bond') return { bg: '#3f6fd8', fg: '#fff', text: monogram(d.s) };
    if (d.type === 'bopreal') return { bg: '#5c6bc0', fg: '#fff', text: 'BP' };
    if (d.type === 'cer') return { bg: '#26a69a', fg: '#fff', text: monogram(d.s) };
    if (d.type === 'dlk') return { bg: '#00897b', fg: '#fff', text: monogram(d.s) };
    if (d.type === 'letra') return { bg: '#7e57c2', fg: '#fff', text: monogram(d.s) };
    if (d.type === 'on') return { bg: '#8d6e63', fg: '#fff', text: monogram(d.s) };
    if (d.type === 'fx') return { bg: '#43a047', fg: '#fff', text: '$' };
    if (d.type === 'index') return { bg: '#455a64', fg: '#fff', text: monogram(d.s.replace('^', '')) };
    if (d.type === 'etf') return { bg: '#1e88e5', fg: '#fff', text: monogram(d.s) };

    var col = PALETTE[hash(d.s) % PALETTE.length];
    return { bg: col, fg: fgFor(col), text: monogram(d.s) };
  }

  function flagPath(mkt) {
    if (mkt === 'ar') {
      return '<rect width="12" height="12" rx="6" fill="#fff"/>' +
        '<path d="M0 2.6h12v2.2H0z" fill="#74acdf"/><path d="M0 7.2h12v2.2H0z" fill="#74acdf"/>' +
        '<circle cx="6" cy="6" r="1.15" fill="#f6b40e"/>';
    }
    if (mkt === 'us') {
      return '<rect width="12" height="12" rx="6" fill="#fff"/>' +
        '<path d="M0 1.5h12v1.4H0zM0 4.3h12v1.4H0zM0 7.1h12v1.4H0zM0 9.9h12v1.4H0z" fill="#b22234"/>' +
        '<rect width="6" height="5.7" rx="1" fill="#3c3b6e"/>';
    }
    // Cripto: rombo naranja, sin bandera de país.
    return '<rect width="12" height="12" rx="6" fill="#f0b90b"/>' +
      '<path d="M6 2.6 9.4 6 6 9.4 2.6 6z" fill="#131722"/>';
  }

  /* Marca del activo lista para insertar en el DOM.
     size: diámetro en píxeles. flag: si se dibuja la banderita del mercado. */
  function html(d, size, flag) {
    size = size || 22;
    var f = face(d);
    var fs = Math.round(size * (f.text.length > 1 ? 0.42 : 0.55));
    var img = '';

    if (provider && d) {
      var url = provider.replace('{s}', encodeURIComponent(d.s)).replace('{mkt}', d.mkt);
      // La imagen tapa al monograma sólo si carga; si falla queda el dibujo.
      img = '<image href="' + esc(url) + '" width="' + size + '" height="' + size +
        '" clip-path="url(#lgclip' + size + ')" preserveAspectRatio="xMidYMid slice"/>';
    }

    return '<svg class="asset-logo" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<defs><clipPath id="lgclip' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 +
      '" r="' + size / 2 + '"/></clipPath></defs>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + size / 2 + '" fill="' + f.bg + '"/>' +
      '<text x="' + size / 2 + '" y="' + (size / 2 + fs * 0.35) + '" text-anchor="middle" ' +
      'font-size="' + fs + '" font-weight="700" fill="' + f.fg + '" ' +
      'font-family="-apple-system, Segoe UI, Roboto, sans-serif">' + esc(f.text) + '</text>' +
      img +
      (flag ? '<g transform="translate(' + (size - 11) + ',' + (size - 11) + ') scale(0.92)">' +
        '<circle cx="6" cy="6" r="6.4" fill="var(--panel)"/>' + flagPath(d ? d.mkt : '') + '</g>' : '') +
      '</svg>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  TV.Logos = {
    html: html,
    face: face,
    setProvider: function (p) { provider = p || ''; },
    getProvider: function () { return provider; }
  };
})();
