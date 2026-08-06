/* LibreCharts — aplicación principal. */
(function () {
  'use strict';
  var TV = window.TV;
  var $ = function (s) { return document.querySelector(s); };
  var LS_KEY = 'librecharts.v3';

  // ---------- estado ----------
  var state = {
    symbol: 'crypto:BTCUSDT',
    interval: '5m',
    type: 'candles',
    theme: 'dark',
    proxy: '',
    logos: '',
    preferCrypto: 'bybit',
    magnet: false,
    panel: 'watchlist',
    indicators: [{ key: 'volume', params: null, colors: null }],
    watchlist: ['crypto:BTCUSDT', 'crypto:ETHUSDT', 'crypto:SOLUSDT',
      'ar:GGAL', 'ar:YPFD', 'ar:AL30', 'ar:GD30', 'ar:MEP',
      'us:SPY', 'us:QQQ', 'us:AAPL'],
    closedGroups: [],
    alerts: [],
    drawings: {}
  };

  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && typeof saved === 'object') {
      Object.keys(state).forEach(function (k) {
        if (saved[k] != null) state[k] = saved[k];
      });
    }
  } catch (e) { }

  TV.Data.settings.proxy = state.proxy || '';
  TV.Data.settings.preferCrypto = state.preferCrypto || 'bybit';
  TV.Logos.setProvider(state.logos || '');

  var saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      state.indicators = chart.indicators.map(function (i) {
        return { key: i.key, params: i.params, colors: i.colors };
      });
      state.drawings[state.symbol] = chart.getDrawings();
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { }
    }, 300);
  }

  // ---------- gráfico ----------
  document.body.className = 'theme-' + state.theme;

  var feed = new TV.Data.Feed();
  var tickers = new TV.Data.Tickers();
  var current = null;

  var chart = new TV.Chart($('#chart-mount'), {
    theme: state.theme,
    onCrosshair: onCrosshair,
    onLayout: positionIndLegends,
    onNeedHistory: loadOlder,
    onDrawingsChange: persist,
    onIndicatorsChange: syncIndicators,
    onToolDone: function () { setActiveToolBtn('cursor'); }
  });

  chart.stack.appendChild($('#legend'));
  chart.magnet = !!state.magnet;

  // ---------- conexión ----------
  feed.onStatus = function (s, label) {
    var el = $('#conn'), txt = $('#conn-text');
    el.className = 'conn';
    if (s === 'live') { el.classList.add('live'); txt.textContent = 'EN VIVO'; }
    else if (s === 'demo') { el.classList.add('demo'); txt.textContent = 'MODO DEMO'; }
    else if (s === 'err') { el.classList.add('err'); txt.textContent = 'SIN DATOS'; }
    else txt.textContent = 'Conectando…';
    if (label) $('#sb-source').textContent = label;
  };

  // ---------- carga de datos ----------
  var loadSeq = 0;
  function loadSymbol(desc, interval) {
    if (!desc) return;
    var seq = ++loadSeq;
    current = desc;
    state.symbol = TV.Catalog.key(desc);
    state.interval = interval;

    $('#cur-symbol').textContent = desc.s;
    $('#cur-logo').innerHTML = TV.Logos.html(desc, 18, true);
    document.title = desc.s + ' · ' + tfLabel(interval) + ' — LibreCharts';
    $('#loading').hidden = false;
    setActiveTf(interval);
    feed.closeLive();

    feed.load(desc, interval, 1000).then(function (candles) {
      if (seq !== loadSeq) return;
      $('#loading').hidden = true;
      chart.setData(candles, desc.s, interval, TV.Data.INTERVAL_MS[interval]);
      chart.setDrawings(state.drawings[state.symbol] || []);
      $('#sb-source').textContent = feed.source ? feed.source.label : '—';

      if (feed.demoMode) {
        feed.onStatus('demo', 'demostración');
        feed.seedDemoLive(candles[candles.length - 1]);
      }
      feed.openLive(desc, interval, function (k) {
        if (seq !== loadSeq) return;
        chart.mergeLive(k);
        checkAlerts(k.close);
        updateLegend(null);
      });
      updateLegend(null);
      renderWatchlist();
      renderAlerts();
      persist();
    });
  }

  function loadOlder() {
    if (!chart || !current) return;
    var first = chart.candles[0];
    if (!first) { chart.historyLoaded(); return; }
    feed.loadOlder(current, state.interval, first.time, 1000).then(function (older) {
      chart.prepend(older);
      chart.historyLoaded();
    });
  }

  function mktLabel(d) {
    return d.mkt === 'ar' ? 'BYMA' : d.mkt === 'us' ? 'EE.UU.' : 'Cripto';
  }

  function ccySymbol(d) {
    if (!d) return '';
    if (d.ccy === 'ARS') return '$';
    if (d.ccy === 'USD') return 'US$';
    return '';
  }

  var TF_LABELS = {
    '1m': '1 min', '3m': '3 min', '5m': '5 min', '15m': '15 min', '30m': '30 min',
    '1h': '1 hora', '2h': '2 horas', '4h': '4 horas', '6h': '6 horas', '8h': '8 horas',
    '12h': '12 horas', '1d': 'Diario', '3d': '3 días', '1w': 'Semanal',
    '1M': 'Mensual', '3M': 'Trimestral'
  };
  function tfLabel(tf) { return TF_LABELS[tf] || tf; }

  // ---------- leyenda ----------
  function fmtPct(v) { return (v >= 0 ? '+' : '') + TV.fmtN(v, 2) + '%'; }

  function updateLegend(idx) {
    if (!chart) return;
    var c = chart.candles;
    if (!c.length || !current) return;
    var i = idx == null ? c.length - 1 : idx;
    var k = chart.display[i] || c[i];
    if (!k) return;
    var prev = i > 0 ? (chart.display[i - 1] || c[i - 1]) : k;
    var diff = k.close - prev.close;
    var chg = prev.close ? diff / prev.close * 100 : 0;
    var cls = k.close >= k.open ? 'up' : 'down';
    var dec = chart.decimals;
    var cur = ccySymbol(current);
    var src = feed.source ? feed.source.label : '';
    var cat = feed.cryptoCategory === 'linear' ? 'Contrato perpetuo' : null;

    var vol = (current.type === 'fx' || current.type === 'index')
      ? '' : '<span class="muted">Vol</span><span>' + TV.fmtVol(k.volume) + '</span>';

    $('#legend-main').innerHTML =
      '<span class="lg-logo">' + TV.Logos.html(current, 16, true) + '</span>' +
      '<span class="sym">' + esc(current.s) + '</span>' +
      '<span class="desc">' + esc(cat || current.n) + '</span>' +
      '<span class="muted">·</span><span class="muted">' + esc(tfLabel(state.interval)) + '</span>' +
      (src ? '<span class="src-tag">' + esc(src) + '</span>' : '') +
      '<span class="ohlc">' +
      '<span class="muted">O</span> <span class="' + cls + '">' + cur + TV.fmtN(k.open, dec) + '</span> ' +
      '<span class="muted">H</span> <span class="' + cls + '">' + cur + TV.fmtN(k.high, dec) + '</span> ' +
      '<span class="muted">L</span> <span class="' + cls + '">' + cur + TV.fmtN(k.low, dec) + '</span> ' +
      '<span class="muted">C</span> <span class="' + cls + '">' + cur + TV.fmtN(k.close, dec) + '</span> ' +
      '<span class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '+' : '') + TV.fmtN(diff, dec) +
      ' (' + fmtPct(chg) + ')</span></span>' +
      vol;

    chart.indicators.forEach(function (ins) {
      var row = document.getElementById('lg-' + ins.id);
      if (!row) return;
      var vals = chart.indicatorValuesAt(ins, i);
      var span = row.querySelector('.lg-vals');
      if (span) {
        span.innerHTML = vals.map(function (v) {
          var txt = v.vol ? TV.fmtVol(v.v) : TV.fmtN(v.v, v.v != null && Math.abs(v.v) < 10 ? 4 : 2);
          return '<span style="color:' + esc(v.color || 'inherit') + '">' + txt + '</span>';
        }).join(' ');
      }
    });
  }

  function onCrosshair(idx) {
    updateLegend(idx);
    if (state.panel === 'data') renderDataWindow(idx);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function rebuildIndLegend() {
    var box = $('#legend-inds');
    box.innerHTML = '';
    chart.indicators.forEach(function (ins) {
      var row = document.createElement('div');
      row.className = 'legend-row ind';
      row.id = 'lg-' + ins.id;
      row.innerHTML =
        '<span class="lg-name' + (ins.visible ? '' : ' ind-off') + '">' + esc(chart.indicatorLabel(ins)) + '</span>' +
        '<span class="lg-vals"></span>' +
        '<span class="lg-btns">' +
        '<button class="lg-btn" data-act="eye" title="Mostrar/ocultar">👁</button>' +
        '<button class="lg-btn" data-act="cfg" title="Configurar">⚙</button>' +
        '<button class="lg-btn x" data-act="del" title="Quitar">✕</button>' +
        '</span>';
      row.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.lg-btn');
        if (!btn) return;
        var act = btn.dataset.act;
        if (act === 'del') chart.removeIndicator(ins.id);
        else if (act === 'cfg') openSettings(ins.id);
        else if (act === 'eye') chart.toggleIndicator(ins.id);
      });
      box.appendChild(row);
    });
    var n = chart.indicators.length;
    var badge = $('#ind-badge');
    badge.hidden = n === 0;
    badge.textContent = n;
    positionIndLegends(null);
    updateLegend(null);
  }

  function positionIndLegends(rects) {
    if (!chart) return;
    rects = rects || chart._paneRects;
    if (!rects) return;
    rects.forEach(function (r) {
      if (r.kind !== 'ind') return;
      var row = document.getElementById('lg-' + r.ins.id);
      if (!row) return;
      row.classList.add('abs');
      row.style.top = (r.top + 4) + 'px';
    });
    chart.indicators.forEach(function (ins) {
      if (ins.def.cat !== 'overlay') return;
      var row = document.getElementById('lg-' + ins.id);
      if (!row) return;
      row.classList.remove('abs');
      row.style.top = '';
    });
  }

  // ---------- indicadores ----------
  function syncIndicators() {
    rebuildIndLegend();
    renderIndModalCounts();
    if (state.panel === 'data') renderDataWindow(null);
    persist();
  }

  function addIndicator(key, params, colors) { chart.addIndicator(key, params, colors); }

  function renderIndModalCounts() {
    var n = chart.indicators.length;
    $('#ind-count').textContent = n + (n === 1 ? ' indicador activo' : ' indicadores activos');
    document.querySelectorAll('.ind-item').forEach(function (el) {
      var cnt = chart.indicators.filter(function (i) { return i.key === el.dataset.key; }).length;
      el.querySelector('.i-count').textContent = cnt ? '× ' + cnt : '';
    });
  }

  function buildIndModal() {
    var list = $('#ind-list');
    var q = ($('#ind-q').value || '').toLowerCase().trim();
    list.innerHTML = '';
    [['overlay', 'Superposiciones (sobre el precio)'], ['oscillator', 'Osciladores (panel propio)']].forEach(function (cat) {
      var defs = TV.Indicators.defs.filter(function (d) {
        return d.cat === cat[0] && (!q || d.name.toLowerCase().indexOf(q) >= 0 || d.short.toLowerCase().indexOf(q) >= 0);
      });
      if (!defs.length) return;
      var h = document.createElement('div');
      h.className = 'ind-cat';
      h.textContent = cat[1];
      list.appendChild(h);
      defs.forEach(function (d) {
        var el = document.createElement('div');
        el.className = 'ind-item';
        el.dataset.key = d.key;
        el.innerHTML = '<span class="i-name">' + esc(d.name) + ' <span style="color:var(--text-muted)">· ' + esc(d.short) + '</span></span>' +
          '<span class="i-count"></span><button class="i-add">Añadir</button>';
        el.addEventListener('click', function () { addIndicator(d.key); });
        list.appendChild(el);
      });
    });
    renderIndModalCounts();
  }

  // ---------- configuración de indicador ----------
  var settingsFor = null;
  function openSettings(id) {
    var ins = chart.indicators.find(function (i) { return i.id === id; });
    if (!ins) return;
    settingsFor = id;
    $('#set-title').textContent = ins.def.name;
    var form = $('#set-form');
    form.innerHTML = '';
    ins.def.params.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'set-row';
      if (p.type === 'source') {
        row.innerHTML = '<label>' + esc(p.label) + '</label>';
        var sel = document.createElement('select');
        sel.dataset.param = p.k;
        TV.Indicators.SOURCES.forEach(function (s) {
          var o = document.createElement('option');
          o.value = s[0]; o.textContent = s[1];
          if (ins.params[p.k] === s[0]) o.selected = true;
          sel.appendChild(o);
        });
        row.appendChild(sel);
      } else {
        row.innerHTML = '<label>' + esc(p.label) + '</label>' +
          '<input type="number" data-param="' + esc(p.k) + '" value="' + ins.params[p.k] + '"' +
          ' min="' + (p.min != null ? p.min : 1) + '" max="' + (p.max != null ? p.max : 1000) + '"' +
          ' step="' + (p.step || (p.type === 'float' ? 0.01 : 1)) + '">';
      }
      form.appendChild(row);
    });
    ins.def.colors.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = '<label>' + esc(c.label) + '</label>' +
        '<input type="color" data-color="' + esc(c.k) + '" value="' + esc(ins.colors[c.k] || '#2962ff') + '">';
      form.appendChild(row);
    });
    openModal('#modal-settings');
  }

  $('#set-apply').addEventListener('click', function () {
    var ins = chart.indicators.find(function (i) { return i.id === settingsFor; });
    if (!ins) { closeModals(); return; }
    var params = {}, colors = {};
    document.querySelectorAll('#set-form [data-param]').forEach(function (el) {
      var pd = ins.def.params.find(function (p) { return p.k === el.dataset.param; });
      if (!pd) return;
      if (pd.type === 'source') params[el.dataset.param] = el.value;
      else {
        var v = parseFloat(el.value);
        if (isFinite(v)) {
          if (pd.min != null) v = Math.max(pd.min, v);
          if (pd.max != null) v = Math.min(pd.max, v);
          params[el.dataset.param] = pd.type === 'int' ? Math.round(v) : v;
        }
      }
    });
    document.querySelectorAll('#set-form [data-color]').forEach(function (el) {
      colors[el.dataset.color] = el.value;
    });
    chart.updateIndicator(settingsFor, params, colors);
    closeModals();
  });

  // ---------- modales y menús ----------
  function openModal(sel) {
    closeModals();
    $(sel).hidden = false;
    var inp = $(sel).querySelector('input[type="text"]');
    if (inp && sel !== '#modal-sources') { inp.value = ''; inp.focus(); }
    if (sel === '#modal-ind') buildIndModal();
    if (sel === '#modal-symbol') buildSymList();
    if (sel === '#modal-sources') openSources();
  }
  function closeModals() {
    document.querySelectorAll('.modal').forEach(function (m) { m.hidden = true; });
  }
  document.querySelectorAll('.modal').forEach(function (m) {
    m.addEventListener('mousedown', function (ev) { if (ev.target === m) closeModals(); });
  });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', closeModals);
  });

  function closeMenus() {
    document.querySelectorAll('.menu').forEach(function (m) { m.hidden = true; });
  }
  document.addEventListener('mousedown', function (ev) {
    if (!ev.target.closest('.menu-wrap')) closeMenus();
  });
  function toggleMenu(sel) {
    var m = $(sel), wasHidden = m.hidden;
    closeMenus();
    m.hidden = !wasHidden;
  }

  // ---------- búsqueda de activos ----------
  var symFilter = { mkt: 'all', type: 'all' };

  function buildFilterChips() {
    var mBox = $('#sym-markets');
    mBox.innerHTML = '';
    TV.Catalog.MARKETS.forEach(function (m) {
      var b = document.createElement('button');
      b.className = 'chip' + (symFilter.mkt === m.id ? ' on' : '');
      b.textContent = m.label;
      b.addEventListener('click', function () {
        symFilter.mkt = m.id;
        symFilter.type = 'all';
        buildSymList();
      });
      mBox.appendChild(b);
    });

    var tBox = $('#sym-types');
    tBox.innerHTML = '';
    var groups = symFilter.mkt === 'ar'
      ? TV.Catalog.AR_GROUPS
      : symFilter.mkt === 'us'
        ? [{ id: 'stock', label: 'Acciones' }, { id: 'etf', label: 'ETF' }, { id: 'adr', label: 'ADR argentinos' }, { id: 'index', label: 'Índices' }]
        : symFilter.mkt === 'crypto'
          ? [{ id: 'bybit', label: 'Operables en Bybit' }]
          : [];
    if (!groups.length) { tBox.hidden = true; return; }
    tBox.hidden = false;
    [{ id: 'all', label: 'Todos' }].concat(groups).forEach(function (g) {
      var b = document.createElement('button');
      b.className = 'chip sm' + (symFilter.type === g.id ? ' on' : '');
      b.textContent = g.label;
      b.addEventListener('click', function () {
        symFilter.type = g.id;
        buildSymList();
      });
      tBox.appendChild(b);
    });
  }

  function buildSymList() {
    buildFilterChips();
    var q = ($('#sym-q').value || '').trim();
    var list = $('#sym-list');
    list.innerHTML = '';

    var type = symFilter.type;
    var onlyBybit = type === 'bybit';
    var results = TV.Catalog.search(q, symFilter.mkt, onlyBybit ? 'all' : type, 160);
    if (onlyBybit) results = results.filter(function (d) { return d.bybit; });
    results = results.slice(0, 120);

    results.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'sym-item';
      el.innerHTML =
        '<span class="s-logo">' + TV.Logos.html(d, 22, true) + '</span>' +
        '<span class="s-sym">' + esc(d.s) + '</span>' +
        '<span class="s-name">' + esc(d.n) + '</span>' +
        (d.bybit ? '<span class="s-tag bybit">' + (d.bybitSpotOnly ? 'Bybit spot' : 'Bybit') + '</span>' : '') +
        '<span class="s-tag mkt-' + d.mkt + '">' + esc(mktLabel(d)) + '</span>' +
        // En cripto el tipo repite al mercado; no se muestra dos veces.
        (d.type === 'crypto' ? '' : '<span class="s-tag">' + esc(TV.Catalog.typeLabel(d)) + '</span>');
      el.addEventListener('click', function () {
        closeModals();
        loadSymbol(d, state.interval);
      });
      list.appendChild(el);
    });

    if (q && !results.some(function (d) { return d.s.toUpperCase() === q.toUpperCase(); })) {
      var el2 = document.createElement('div');
      el2.className = 'sym-item custom';
      el2.innerHTML = '<span class="s-logo">' + TV.Logos.html({ s: q.toUpperCase(), mkt: symFilter.mkt === 'all' ? 'us' : symFilter.mkt, type: 'stock' }, 22, false) + '</span>' +
        '<span class="s-sym">' + esc(q.toUpperCase()) + '</span>' +
        '<span class="s-name">Abrir como símbolo escrito a mano</span><span class="s-tag">nuevo</span>';
      el2.addEventListener('click', function () {
        var d = TV.Catalog.improvise(q, symFilter.mkt === 'all' ? null : symFilter.mkt, current && current.mkt);
        if (d) { closeModals(); loadSymbol(d, state.interval); }
      });
      list.appendChild(el2);
    }

    var st = TV.Catalog.stats();
    $('#sym-count').textContent = results.length + ' de ' + st.total + ' activos';
    if (!results.length && !q) {
      list.innerHTML = '<div class="sym-item"><span class="s-name">Sin resultados para este filtro.</span></div>';
    }
  }

  $('#sym-q').addEventListener('input', buildSymList);
  $('#sym-q').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    var first = $('#sym-list .sym-item');
    if (first) first.click();
  });
  $('#ind-q').addEventListener('input', buildIndModal);

  // ---------- fuentes de datos ----------
  function openSources() {
    $('#src-proxy').value = state.proxy || '';
    $('#src-logos').value = state.logos || '';
    $('#src-crypto').value = state.preferCrypto || 'bybit';
    var st = TV.Catalog.stats();
    $('#src-stats').textContent =
      st.total + ' (Argentina ' + (st.ar || 0) + ' · EE.UU. ' + (st.us || 0) + ' · cripto ' + (st.crypto || 0) + ')';
    $('#src-msg').hidden = true;
  }

  $('#src-discover').addEventListener('click', function () {
    var msg = $('#src-msg');
    msg.hidden = false;
    msg.className = 'src-msg';
    msg.textContent = 'Consultando data912…';
    TV.Data.discoverArgentina().then(function (added) {
      msg.textContent = added
        ? 'Listo: se sumaron ' + added + ' activos que cotizan hoy en BYMA (letras, ONs y nuevas emisiones).'
        : 'El catálogo ya estaba al día.';
      openSources();
      msg.hidden = false;
      renderWatchlist();
    }).catch(function (e) {
      msg.className = 'src-msg err';
      msg.textContent = 'No se pudo consultar data912 (' + e.message + '). Suele ser CORS o falta de red: probá con un proxy.';
    });
  });

  $('#src-apply').addEventListener('click', function () {
    state.proxy = ($('#src-proxy').value || '').trim();
    state.logos = ($('#src-logos').value || '').trim();
    state.preferCrypto = $('#src-crypto').value;
    TV.Data.settings.proxy = state.proxy;
    TV.Data.settings.preferCrypto = state.preferCrypto;
    TV.Logos.setProvider(state.logos);
    persist();
    closeModals();
    toast('Fuentes actualizadas, recargando datos…');
    if (current) loadSymbol(current, state.interval);
    startTickers();
  });

  // ---------- barra superior ----------
  $('#btn-symbol').addEventListener('click', function () { openModal('#modal-symbol'); });
  $('#btn-indicators').addEventListener('click', function () { openModal('#modal-ind'); });
  $('#btn-sources').addEventListener('click', function () { openModal('#modal-sources'); });
  $('#rail-indicators').addEventListener('click', function () { openModal('#modal-ind'); });
  $('#rail-sources').addEventListener('click', function () { openModal('#modal-sources'); });
  $('#btn-alerts').addEventListener('click', function () { showPanel('alerts'); });
  $('#btn-add-wl').addEventListener('click', function () {
    if (!current) return;
    var k = TV.Catalog.key(current);
    if (state.watchlist.indexOf(k) >= 0) { toast(current.s + ' ya está en la lista'); return; }
    state.watchlist.push(k);
    renderWatchlist();
    startTickers();
    persist();
    toast(current.s + ' añadido a la lista');
  });

  $('#ind-clear').addEventListener('click', function () {
    if (!chart.indicators.length) { toast('No hay indicadores que quitar'); return; }
    chart.clearIndicators();
  });

  function setActiveTf(tf) {
    var known = false;
    document.querySelectorAll('.tb-btn.tf').forEach(function (b) {
      var on = b.dataset.tf === tf;
      b.classList.toggle('active', on);
      if (on) known = true;
    });
    document.querySelectorAll('#tf-menu button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tf === tf);
    });
    $('#tf-more').classList.toggle('active', !known);
  }
  document.querySelectorAll('.tb-btn.tf').forEach(function (b) {
    b.addEventListener('click', function () { loadSymbol(current, b.dataset.tf); });
  });
  $('#tf-more').addEventListener('click', function (ev) { ev.stopPropagation(); toggleMenu('#tf-menu'); });
  document.querySelectorAll('#tf-menu button').forEach(function (b) {
    b.addEventListener('click', function () {
      closeMenus();
      loadSymbol(current, b.dataset.tf);
    });
  });

  var TYPE_ICONS = {
    candles: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4v3m0 10v3M17 3v5m0 8v4"/><rect x="4.5" y="7" width="5" height="10" rx="1"/><rect x="14.5" y="8" width="5" height="8" rx="1"/></svg>',
    heikin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4v3m0 10v3M17 3v5m0 8v4"/><rect x="4.5" y="7" width="5" height="10" rx="1" fill="currentColor" fill-opacity=".25"/><rect x="14.5" y="8" width="5" height="8" rx="1" fill="currentColor" fill-opacity=".25"/></svg>',
    bars: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4v16M4 8h3m0 5h3M17 4v16M14 9h3m0 5h3"/></svg>',
    line: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l5-6 4 3 9-9"/></svg>',
    area: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l5-6 4 3 9-9"/><path d="M3 17l5-6 4 3 9-9v14H3z" fill="currentColor" fill-opacity=".22" stroke="none"/></svg>'
  };
  function setChartType(t) {
    state.type = t;
    chart.setType(t);
    $('#type-icon').innerHTML = TYPE_ICONS[t] || TYPE_ICONS.candles;
    document.querySelectorAll('#type-menu button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.type === t);
    });
    updateLegend(null);
    persist();
  }
  $('#btn-type').addEventListener('click', function (ev) { ev.stopPropagation(); toggleMenu('#type-menu'); });
  document.querySelectorAll('#type-menu button').forEach(function (b) {
    b.addEventListener('click', function () { closeMenus(); setChartType(b.dataset.type); });
  });

  $('#btn-theme').addEventListener('click', function () {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.className = 'theme-' + state.theme;
    chart.setTheme(state.theme);
    persist();
  });

  $('#btn-full').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });

  $('#btn-shot').addEventListener('click', function () {
    var name = current ? current.s : 'grafico';
    var cv = chart.snapshot(name + ' · ' + tfLabel(state.interval) + ' — LibreCharts');
    cv.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '_' + state.interval + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
    toast('Imagen del gráfico descargada 📷');
  });

  $('#btn-undo').addEventListener('click', function () {
    if (!chart.undo()) toast('No hay nada que deshacer');
  });
  $('#btn-redo').addEventListener('click', function () {
    if (!chart.redo()) toast('No hay nada que rehacer');
  });

  // ---------- rangos ----------
  var RANGES = {
    '1D': 86400e3, '5D': 5 * 86400e3, '1M': 30 * 86400e3, '3M': 91 * 86400e3,
    '6M': 182 * 86400e3, '1A': 365 * 86400e3, '5A': 5 * 365 * 86400e3, 'ALL': null
  };
  document.querySelectorAll('.range').forEach(function (b) {
    b.addEventListener('click', function () {
      var r = b.dataset.range;
      var ms;
      if (r === 'YTD') {
        var now = new Date();
        ms = now - Date.UTC(now.getUTCFullYear(), 0, 1);
      } else ms = RANGES[r];
      chart.zoomToRange(ms);
      document.querySelectorAll('.range').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });

  // ---------- herramientas de dibujo ----------
  function setActiveToolBtn(tool) {
    document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
  }
  document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
    b.addEventListener('click', function () {
      setActiveToolBtn(b.dataset.tool);
      chart.setTool(b.dataset.tool);
    });
  });
  $('#btn-clear-draw').addEventListener('click', function () {
    if (!chart.drawings.length) { toast('No hay dibujos que borrar'); return; }
    chart.clearDrawings();
    toast('Dibujos eliminados');
  });
  $('#btn-magnet').addEventListener('click', function () {
    state.magnet = !state.magnet;
    chart.magnet = state.magnet;
    this.classList.toggle('active', state.magnet);
    toast(state.magnet ? 'Imán activado: los dibujos se pegan a O/H/L/C' : 'Imán desactivado');
    persist();
  });

  // ---------- panel derecho ----------
  function showPanel(name) {
    state.panel = name;
    ['watchlist', 'data', 'alerts'].forEach(function (p) {
      $('#panel-' + p).hidden = p !== name;
    });
    document.querySelectorAll('.rail-btn[data-panel]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.panel === name);
    });
    if (name === 'data') renderDataWindow(null);
    if (name === 'alerts') renderAlerts();
    persist();
  }
  document.querySelectorAll('.rail-btn[data-panel]').forEach(function (b) {
    b.addEventListener('click', function () { showPanel(b.dataset.panel); });
  });

  // ---------- lista de seguimiento ----------
  var wlPrices = {};
  function watchDescs() {
    return state.watchlist.map(function (k) { return TV.Catalog.get(k) || TV.Catalog.resolve(k); }).filter(Boolean);
  }

  var GROUP_LABEL = { ar: 'Argentina', us: 'Estados Unidos', crypto: 'Cripto' };

  function renderWatchlist() {
    var box = $('#watchlist');
    box.innerHTML = '';
    var groups = {};
    watchDescs().forEach(function (d) {
      (groups[d.mkt] = groups[d.mkt] || []).push(d);
    });

    ['crypto', 'ar', 'us'].forEach(function (mkt) {
      var items = groups[mkt];
      if (!items || !items.length) return;
      var closed = state.closedGroups.indexOf(mkt) >= 0;

      var head = document.createElement('div');
      head.className = 'wl-group' + (closed ? ' closed' : '');
      head.innerHTML = '<svg class="caret" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>' +
        esc(GROUP_LABEL[mkt] || mkt) + ' <span style="opacity:.6">(' + items.length + ')</span>';
      head.addEventListener('click', function () {
        var i = state.closedGroups.indexOf(mkt);
        if (i >= 0) state.closedGroups.splice(i, 1); else state.closedGroups.push(mkt);
        renderWatchlist();
        persist();
      });
      box.appendChild(head);
      if (closed) return;

      items.forEach(function (d) {
        var k = TV.Catalog.key(d);
        var el = document.createElement('div');
        el.className = 'wl-item' + (k === state.symbol ? ' active' : '');
        el.dataset.k = k;
        var p = wlPrices[k];
        el.innerHTML =
          '<span class="wl-sym">' + TV.Logos.html(d, 20, true) +
          '<span class="wl-name">' + esc(d.s) + '</span></span>' +
          '<span class="wl-px">' + (p ? TV.fmtN(p.px, TV.decimalsFor(p.px)) : '—') + '</span>' +
          '<span class="wl-chg ' + (p && p.pct < 0 ? 'down' : 'up') + '">' +
          (p ? (p.pct >= 0 ? '+' : '') + TV.fmtN(p.pct, 2) + '%' : '') + '</span>' +
          '<button class="wl-del" title="Quitar">✕</button>';
        el.addEventListener('click', function (ev) {
          if (ev.target.classList.contains('wl-del')) {
            state.watchlist = state.watchlist.filter(function (x) { return x !== k; });
            renderWatchlist();
            startTickers();
            persist();
            return;
          }
          loadSymbol(d, state.interval);
        });
        box.appendChild(el);
      });
    });
  }

  function startTickers() {
    tickers.demo = feed.demoMode;
    tickers.onTick = function (k, px, pct) {
      var prev = wlPrices[k];
      wlPrices[k] = { px: px, pct: pct };
      var el = document.querySelector('.wl-item[data-k="' + k + '"]');
      if (!el) return;
      el.querySelector('.wl-px').textContent = TV.fmtN(px, TV.decimalsFor(px));
      var chgEl = el.querySelector('.wl-chg');
      chgEl.textContent = (pct >= 0 ? '+' : '') + TV.fmtN(pct, 2) + '%';
      chgEl.className = 'wl-chg ' + (pct < 0 ? 'down' : 'up');
      if (prev && Math.abs(prev.px - px) > 1e-12) {
        el.classList.remove('wl-flash-up', 'wl-flash-down');
        void el.offsetWidth;
        el.classList.add(px > prev.px ? 'wl-flash-up' : 'wl-flash-down');
      }
    };
    tickers.watch(watchDescs());
  }

  function addToWatchlist() {
    var v = ($('#wl-input').value || '').trim();
    if (!v) return;
    var pref = current ? current.mkt : null;
    var d = TV.Catalog.resolve(v, pref) || TV.Catalog.improvise(v, null, pref);
    if (!d) { toast('Símbolo no válido'); return; }
    var k = TV.Catalog.key(d);
    if (state.watchlist.indexOf(k) < 0) {
      state.watchlist.push(k);
      renderWatchlist();
      startTickers();
      persist();
      toast(d.s + ' añadido (' + mktLabel(d) + ')');
    }
    $('#wl-input').value = '';
  }
  $('#wl-add').addEventListener('click', addToWatchlist);
  $('#wl-input').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') addToWatchlist(); });

  // Nombres legibles de las series que publica cada indicador.
  var OUT_LABELS = {
    v: 'Valor', ma: 'Media', basis: 'Media', up: 'Banda superior', lo: 'Banda inferior',
    dn: 'Bajista', h: 'Histograma', macd: 'MACD', sig: 'Señal', k: '%K', d: '%D',
    adx: 'ADX', dip: '+DI', dim: '−DI', tenkan: 'Tenkan-sen', kijun: 'Kijun-sen',
    chikou: 'Chikou span', sa: 'Senkou A', sb: 'Senkou B'
  };

  // ---------- ventana de datos ----------
  function renderDataWindow(idx) {
    var box = $('#datawindow');
    var c = chart.candles;
    if (!c.length || !current) { box.innerHTML = '<div class="al-empty">Sin datos.</div>'; return; }
    var i = idx == null ? c.length - 1 : idx;
    var k = chart.display[i] || c[i];
    if (!k) return;
    var prev = i > 0 ? (chart.display[i - 1] || c[i - 1]) : k;
    var diff = k.close - prev.close;
    var chg = prev.close ? diff / prev.close * 100 : 0;
    var dec = chart.decimals;
    var cur = ccySymbol(current);
    var d = new Date(k.time);
    var fecha = ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear();
    if (TV.Data.INTERVAL_MS[state.interval] < 86400e3) {
      fecha += ' ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
    }

    var html = '<div class="dw-sec">' + esc(current.s) + ' · ' + esc(tfLabel(state.interval)) + '</div>' +
      row('Fecha', fecha) +
      row('Apertura', cur + TV.fmtN(k.open, dec)) +
      row('Máximo', cur + TV.fmtN(k.high, dec)) +
      row('Mínimo', cur + TV.fmtN(k.low, dec)) +
      row('Cierre', cur + TV.fmtN(k.close, dec)) +
      row('Variación', '<span class="' + (diff >= 0 ? 'lg-up' : 'lg-dn') + '">' +
        (diff >= 0 ? '+' : '') + TV.fmtN(diff, dec) + ' (' + fmtPct(chg) + ')</span>') +
      row('Volumen', TV.fmtVol(k.volume));

    chart.indicators.forEach(function (ins) {
      var vals = chart.indicatorValuesAt(ins, i);
      if (!vals.length) return;
      html += '<div class="dw-sec">' + esc(chart.indicatorLabel(ins)) + '</div>';
      var outs = ins.result ? ins.result.outputs.filter(function (o) { return o.kind !== 'fill' && o.kind !== 'cloud'; }) : [];
      vals.forEach(function (v, n) {
        var key = outs[n] && outs[n].key ? outs[n].key : 'v';
        html += row(OUT_LABELS[key] || key, '<span style="color:' + esc(v.color || 'inherit') + '">' +
          (v.vol ? TV.fmtVol(v.v) : TV.fmtN(v.v, 4)) + '</span>');
      });
    });
    box.innerHTML = html;

    function row(a, b) {
      return '<div class="dw-row"><span>' + esc(a) + '</span><b>' + b + '</b></div>';
    }
  }

  // ---------- alertas de precio ----------
  function renderAlerts() {
    var box = $('#alerts-list');
    var mine = state.alerts;
    var badge = $('#alert-badge');
    var pend = mine.filter(function (a) { return !a.fired; }).length;
    badge.hidden = pend === 0;
    badge.textContent = pend;

    if (!mine.length) {
      box.innerHTML = '<div class="al-empty">Todavía no creaste alertas. Poné un precio arriba y se avisa cuando el activo lo cruce.</div>';
      return;
    }
    box.innerHTML = '';
    mine.slice().reverse().forEach(function (a) {
      var d = TV.Catalog.get(a.key);
      var el = document.createElement('div');
      el.className = 'al-item' + (a.fired ? ' fired' : '');
      el.innerHTML =
        '<span class="al-sym">' + esc(d ? d.s : a.key) + '</span>' +
        '<span class="al-cond">' + (a.dir === 'above' ? '≥ ' : '≤ ') + TV.fmtN(a.price, 4) +
        (a.fired ? ' · disparada' : '') + '</span>' +
        '<button class="al-del" title="Quitar">✕</button>';
      el.querySelector('.al-del').addEventListener('click', function () {
        state.alerts = state.alerts.filter(function (x) { return x.id !== a.id; });
        renderAlerts();
        persist();
      });
      box.appendChild(el);
    });
  }

  $('#al-add').addEventListener('click', function () {
    var px = parseFloat($('#al-price').value);
    if (!isFinite(px) || !current) { toast('Poné un precio válido'); return; }
    state.alerts.push({
      id: 'a' + Date.now(),
      key: TV.Catalog.key(current),
      price: px,
      dir: $('#al-dir').value,
      fired: false
    });
    $('#al-price').value = '';
    renderAlerts();
    persist();
    toast('Alerta creada para ' + current.s);
    if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
  });

  var lastClose = null;
  function checkAlerts(close) {
    if (!current || close == null) return;
    var key = TV.Catalog.key(current);
    var prev = lastClose;
    lastClose = close;
    if (prev == null) return;
    var changed = false;
    state.alerts.forEach(function (a) {
      if (a.fired || a.key !== key) return;
      var hit = a.dir === 'above' ? (prev < a.price && close >= a.price)
        : (prev > a.price && close <= a.price);
      if (!hit) return;
      a.fired = true;
      changed = true;
      var msg = current.s + ' cruzó ' + TV.fmtN(a.price, chart.decimals);
      toast('🔔 ' + msg);
      try {
        if (window.Notification && Notification.permission === 'granted') {
          new Notification('LibreCharts', { body: msg });
        }
      } catch (e) { }
    });
    if (changed) { renderAlerts(); persist(); }
  }

  // ---------- varios ----------
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  setInterval(function () {
    var d = new Date();
    $('#sb-clock').textContent =
      ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2) + ':' +
      ('0' + d.getUTCSeconds()).slice(-2) + ' UTC';
  }, 1000);

  window.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (ev.key === 'Escape') { closeModals(); closeMenus(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); chart.undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); chart.redo(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 's' || ev.key === 'S') openModal('#modal-symbol');
    else if (ev.key === 'i' || ev.key === 'I') openModal('#modal-ind');
    else if (ev.key === 'a' || ev.key === 'A') showPanel('alerts');
  });

  // ---------- arranque ----------
  setChartType(state.type);
  setActiveTf(state.interval);
  showPanel(state.panel || 'watchlist');
  $('#btn-magnet').classList.toggle('active', !!state.magnet);

  (state.indicators || []).forEach(function (d) {
    chart.addIndicator(d.key, d.params, d.colors);
  });
  rebuildIndLegend();

  var startDesc = TV.Catalog.get(state.symbol) || TV.Catalog.resolve(state.symbol) || TV.Catalog.get('crypto:BTCUSDT');
  loadSymbol(startDesc, state.interval);
  renderWatchlist();
  renderAlerts();

  var tickerStart = setInterval(function () {
    if (chart.candles.length) {
      clearInterval(tickerStart);
      startTickers();
    }
  }, 700);

  TV.Data.discoverArgentina().then(function (added) {
    if (added) console.info('LibreCharts: ' + added + ' activos argentinos descubiertos en vivo.');
  }).catch(function () { /* sin red: queda el catálogo estático */ });

  window.App = {
    chart: chart, feed: feed, state: state, catalog: TV.Catalog,
    addIndicator: addIndicator, loadSymbol: loadSymbol, showPanel: showPanel
  };
})();
