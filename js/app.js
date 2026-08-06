/* LibreCharts — aplicación principal. */
(function () {
  'use strict';
  var TV = window.TV;
  var $ = function (s) { return document.querySelector(s); };
  var LS_KEY = 'librecharts.v2';

  // ---------- estado ----------
  var state = {
    symbol: 'ar:GGAL',
    interval: '1d',
    type: 'candles',
    theme: 'dark',
    proxy: '',
    indicators: [{ key: 'volume', params: null, colors: null }],
    watchlist: ['ar:GGAL', 'ar:YPFD', 'ar:AL30', 'ar:GD30', 'ar:MEP', 'us:SPY', 'us:AAPL', 'crypto:BTCUSDT'],
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
  var current = null;   // activo mostrado (descriptor del catálogo)

  var chart = new TV.Chart($('#chart-mount'), {
    theme: state.theme,
    onCrosshair: updateLegend,
    onLayout: positionIndLegends,
    onNeedHistory: loadOlder,
    onDrawingsChange: persist,
    onIndicatorsChange: syncIndicators,
    onToolDone: function () { setActiveToolBtn('cursor'); }
  });

  chart.stack.appendChild($('#legend'));

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
    var chip = $('#cur-mkt');
    chip.textContent = mktLabel(desc);
    chip.className = 'mkt-chip mkt-' + desc.mkt;
    document.title = desc.s + ' · ' + interval.toUpperCase() + ' — LibreCharts';
    $('#loading').hidden = false;
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
        updateLegend(null);
      });
      updateLegend(null);
      persist();
      renderWatchlist();
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

  function mktShort(d) {
    return d.mkt === 'ar' ? 'AR' : d.mkt === 'us' ? 'US' : 'CR';
  }

  function ccySymbol(d) {
    if (!d) return '';
    if (d.ccy === 'ARS') return '$';
    if (d.ccy === 'USD') return 'US$';
    return '';
  }

  // ---------- leyenda ----------
  function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }

  function updateLegend(idx) {
    if (!chart) return;
    var c = chart.candles;
    if (!c.length) return;
    var i = idx == null ? c.length - 1 : idx;
    var k = chart.display[i] || c[i];
    if (!k) return;
    var prev = i > 0 ? (chart.display[i - 1] || c[i - 1]) : k;
    var chg = prev.close ? (k.close - prev.close) / prev.close * 100 : 0;
    var cls = k.close >= k.open ? 'up' : 'down';
    var dec = chart.decimals;
    var cur = ccySymbol(current);
    var volRow = current && (current.type === 'fx' || current.type === 'index')
      ? '' : '<span class="muted">Vol</span><span>' + TV.fmtVol(k.volume) + '</span>';

    $('#legend-main').innerHTML =
      '<span class="sym">' + esc(current ? current.s : '') + '</span>' +
      '<span class="muted">' + esc(current ? mktLabel(current) : '') + '</span>' +
      '<span class="muted">' + esc(state.interval.toUpperCase()) + '</span>' +
      '<span class="muted">O</span><span class="' + cls + '">' + cur + TV.fmtN(k.open, dec) + '</span>' +
      '<span class="muted">H</span><span class="' + cls + '">' + cur + TV.fmtN(k.high, dec) + '</span>' +
      '<span class="muted">L</span><span class="' + cls + '">' + cur + TV.fmtN(k.low, dec) + '</span>' +
      '<span class="muted">C</span><span class="' + cls + '">' + cur + TV.fmtN(k.close, dec) + '</span>' +
      '<span class="' + (chg >= 0 ? 'up' : 'down') + '">' + fmtPct(chg) + '</span>' +
      volRow;

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
    persist();
  }

  function addIndicator(key, params, colors) {
    chart.addIndicator(key, params, colors);
  }

  function renderIndModalCounts() {
    var n = chart.indicators.length;
    $('#ind-count').textContent = n + (n === 1 ? ' indicador activo' : ' indicadores activos');
    document.querySelectorAll('.ind-item').forEach(function (el) {
      var key = el.dataset.key;
      var cnt = chart.indicators.filter(function (i) { return i.key === key; }).length;
      var badge = el.querySelector('.i-count');
      badge.textContent = cnt ? '× ' + cnt : '';
    });
  }

  function buildIndModal() {
    var list = $('#ind-list');
    var q = ($('#ind-q').value || '').toLowerCase().trim();
    list.innerHTML = '';
    var cats = [['overlay', 'Superposiciones (sobre el precio)'], ['oscillator', 'Osciladores (panel propio)']];
    cats.forEach(function (cat) {
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

  // ---------- modales ----------
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
  window.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeModals();
  });

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

    var results = TV.Catalog.search(q, symFilter.mkt, symFilter.type, 120);
    results.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'sym-item';
      el.innerHTML =
        '<span class="s-sym">' + esc(d.s) + '</span>' +
        '<span class="s-name">' + esc(d.n) + '</span>' +
        '<span class="s-tag mkt-' + d.mkt + '">' + esc(mktLabel(d)) + '</span>' +
        '<span class="s-tag">' + esc(TV.Catalog.typeLabel(d)) + '</span>';
      el.addEventListener('click', function () {
        closeModals();
        loadSymbol(d, state.interval);
      });
      list.appendChild(el);
    });

    // Un ticker que no está en el catálogo igual se puede abrir.
    if (q && !results.some(function (d) { return d.s.toUpperCase() === q.toUpperCase(); })) {
      var el2 = document.createElement('div');
      el2.className = 'sym-item custom';
      el2.innerHTML = '<span class="s-sym">' + esc(q.toUpperCase()) + '</span>' +
        '<span class="s-name">Abrir como símbolo escrito a mano</span><span class="s-tag">nuevo</span>';
      el2.addEventListener('click', function () {
        var d = TV.Catalog.improvise(q, symFilter.mkt === 'all' ? null : symFilter.mkt);
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
    TV.Data.settings.proxy = state.proxy;
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
  $('#ind-clear').addEventListener('click', function () {
    if (!chart.indicators.length) { toast('No hay indicadores que quitar'); return; }
    chart.clearIndicators();
  });

  function setActiveTf(tf) {
    document.querySelectorAll('.tb-btn.tf').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tf === tf);
    });
    $('#tf-extra').value = ['3m', '30m', '2h', '6h', '8h', '12h', '3d'].indexOf(tf) >= 0 ? tf : '';
  }
  document.querySelectorAll('.tb-btn.tf').forEach(function (b) {
    b.addEventListener('click', function () {
      setActiveTf(b.dataset.tf);
      loadSymbol(current, b.dataset.tf);
    });
  });
  $('#tf-extra').addEventListener('change', function () {
    if (!this.value) return;
    setActiveTf(this.value);
    loadSymbol(current, this.value);
  });

  $('#chart-type').addEventListener('change', function () {
    state.type = this.value;
    chart.setType(this.value);
    updateLegend(null);
    persist();
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
    var cv = chart.snapshot(name + ' · ' + state.interval.toUpperCase() + ' — LibreCharts');
    cv.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '_' + state.interval + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
    toast('Imagen del gráfico descargada 📷');
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

  // ---------- lista de seguimiento ----------
  var wlPrices = {};
  function watchDescs() {
    return state.watchlist.map(function (k) { return TV.Catalog.get(k) || TV.Catalog.resolve(k); }).filter(Boolean);
  }

  function renderWatchlist() {
    var box = $('#watchlist');
    box.innerHTML = '';
    watchDescs().forEach(function (d) {
      var k = TV.Catalog.key(d);
      var el = document.createElement('div');
      el.className = 'wl-item' + (k === state.symbol ? ' active' : '');
      el.dataset.k = k;
      var p = wlPrices[k];
      el.innerHTML =
        '<span class="wl-sym"><span class="wl-name">' + esc(d.s) + '</span>' +
        '<span class="wl-mkt mkt-' + d.mkt + '">' + esc(mktShort(d)) + '</span></span>' +
        '<span class="wl-px">' + (p ? TV.fmtN(p.px, TV.decimalsFor(p.px)) : '—') + '</span>' +
        '<span class="wl-chg ' + (p && p.pct < 0 ? 'down' : 'up') + '">' + (p ? (p.pct >= 0 ? '+' : '') + p.pct.toFixed(2) + '%' : '') + '</span>' +
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
      chgEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
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
    // Un ticker ambiguo (AAPL es acción en Nasdaq y CEDEAR en BYMA) se resuelve
    // al mercado que se está mirando.
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
      ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2) + ':' + ('0' + d.getUTCSeconds()).slice(-2) + ' UTC';
  }, 1000);

  window.addEventListener('keydown', function (ev) {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA')) return;
    if (ev.key === 's' || ev.key === 'S') openModal('#modal-symbol');
    else if (ev.key === 'i' || ev.key === 'I') openModal('#modal-ind');
  });

  // ---------- arranque ----------
  $('#chart-type').value = state.type;
  chart.setType(state.type);
  setActiveTf(state.interval);

  (state.indicators || []).forEach(function (d) {
    chart.addIndicator(d.key, d.params, d.colors);
  });
  rebuildIndLegend();

  var startDesc = TV.Catalog.get(state.symbol) || TV.Catalog.resolve(state.symbol) || TV.Catalog.get('crypto:BTCUSDT');
  loadSymbol(startDesc, state.interval);
  renderWatchlist();

  var tickerStart = setInterval(function () {
    if (chart.candles.length) {
      clearInterval(tickerStart);
      startTickers();
    }
  }, 700);

  // Completa el catálogo argentino con lo que realmente cotiza hoy.
  TV.Data.discoverArgentina().then(function (added) {
    if (added) console.info('LibreCharts: ' + added + ' activos argentinos descubiertos en vivo.');
  }).catch(function () { /* sin red: queda el catálogo estático */ });

  window.App = {
    chart: chart, feed: feed, state: state, catalog: TV.Catalog,
    addIndicator: addIndicator, loadSymbol: loadSymbol
  };
})();
