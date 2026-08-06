/* LibreCharts — aplicación principal. */
(function () {
  'use strict';
  var TV = window.TV;
  var $ = function (s) { return document.querySelector(s); };
  var LS_KEY = 'librecharts.v1';

  // ---------- estado ----------
  var state = {
    symbol: 'BTCUSDT',
    interval: '1h',
    type: 'candles',
    theme: 'dark',
    indicators: [{ key: 'volume', params: null, colors: null }],
    watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'],
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

  var chart = new TV.Chart($('#chart-mount'), {
    theme: state.theme,
    onCrosshair: updateLegend,
    onLayout: positionIndLegends,
    onNeedHistory: loadOlder,
    onDrawingsChange: persist,
    onIndicatorsChange: syncIndicators,
    onToolDone: function () { setActiveToolBtn('cursor'); }
  });

  // La leyenda vive dentro del lienzo desplazable: así cada rótulo de oscilador
  // acompaña a su panel cuando hay más indicadores de los que caben en pantalla.
  chart.stack.appendChild($('#legend'));

  // ---------- conexión ----------
  feed.onStatus = function (s) {
    var el = $('#conn'), txt = $('#conn-text');
    el.className = 'conn';
    if (s === 'live') { el.classList.add('live'); txt.textContent = 'EN VIVO'; }
    else if (s === 'demo') { el.classList.add('demo'); txt.textContent = 'MODO DEMO'; }
    else if (s === 'err') { el.classList.add('err'); txt.textContent = 'ERROR'; }
    else txt.textContent = 'Conectando…';
  };

  // ---------- carga de datos ----------
  var loadSeq = 0;
  function loadSymbol(symbol, interval) {
    var seq = ++loadSeq;
    state.symbol = symbol;
    state.interval = interval;
    $('#cur-symbol').textContent = symbol;
    document.title = symbol + ' · ' + interval.toUpperCase() + ' — LibreCharts';
    $('#loading').hidden = false;
    feed.closeLive();

    feed.load(symbol, interval, 1000).then(function (candles) {
      if (seq !== loadSeq) return;
      $('#loading').hidden = true;
      chart.setData(candles, symbol, interval, TV.Data.INTERVAL_MS[interval]);
      chart.setDrawings(state.drawings[symbol] || []);
      if (feed.demoMode) {
        feed.onStatus && feed.onStatus('demo');
        feed.seedDemoLive(candles[candles.length - 1]);
      }
      feed.openLive(symbol, interval, function (k) {
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
    if (!chart) return;
    var first = chart.candles[0];
    if (!first) { chart.historyLoaded(); return; }
    feed.loadOlder(state.symbol, state.interval, first.time, 1000).then(function (older) {
      chart.prepend(older);
      chart.historyLoaded();
    });
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
    $('#legend-main').innerHTML =
      '<span class="sym">' + esc(state.symbol) + '</span>' +
      '<span class="muted">' + esc(state.interval.toUpperCase()) + '</span>' +
      '<span class="muted">O</span><span class="' + cls + '">' + TV.fmtN(k.open, dec) + '</span>' +
      '<span class="muted">H</span><span class="' + cls + '">' + TV.fmtN(k.high, dec) + '</span>' +
      '<span class="muted">L</span><span class="' + cls + '">' + TV.fmtN(k.low, dec) + '</span>' +
      '<span class="muted">C</span><span class="' + cls + '">' + TV.fmtN(k.close, dec) + '</span>' +
      '<span class="' + (chg >= 0 ? 'up' : 'down') + '">' + fmtPct(chg) + '</span>' +
      '<span class="muted">Vol</span><span>' + TV.fmtVol(k.volume) + '</span>';

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
        if (act === 'del') removeIndicator(ins.id);
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

  // sitúa la leyenda de cada oscilador sobre su panel
  // (el motor puede llamarnos desde su constructor, antes de que `chart` exista)
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
    // superposiciones apiladas bajo la leyenda principal
    var y = 0;
    chart.indicators.forEach(function (ins) {
      if (ins.def.cat !== 'overlay') return;
      var row = document.getElementById('lg-' + ins.id);
      if (!row) return;
      row.classList.remove('abs');
      row.style.top = '';
    });
  }

  // ---------- indicadores ----------
  // El motor llama aquí ante cualquier alta, baja o cambio de indicador.
  function syncIndicators() {
    rebuildIndLegend();
    renderIndModalCounts();
    persist();
  }

  function addIndicator(key, params, colors) {
    chart.addIndicator(key, params, colors);
  }

  function removeIndicator(id) {
    chart.removeIndicator(id);
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
        el.innerHTML = '<span class="i-name">' + esc(d.name) + ' <span class="muted" style="color:var(--text-muted)">· ' + esc(d.short) + '</span></span>' +
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
    if (inp) { inp.value = ''; inp.focus(); }
    if (sel === '#modal-ind') buildIndModal();
    if (sel === '#modal-symbol') buildSymList();
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

  // ---------- búsqueda de símbolos ----------
  function buildSymList() {
    var q = ($('#sym-q').value || '').toUpperCase().trim();
    var list = $('#sym-list');
    list.innerHTML = '';
    var matches = TV.Data.SYMBOLS.filter(function (s) {
      return !q || s[0].indexOf(q) >= 0 || s[1].toUpperCase().indexOf(q) >= 0;
    });
    if (q && !matches.some(function (s) { return s[0] === q; }) && /^[A-Z0-9]{5,14}$/.test(q)) {
      matches.unshift([q, 'Símbolo personalizado', true]);
    }
    matches.slice(0, 60).forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'sym-item';
      el.innerHTML = '<span class="s-sym">' + esc(s[0]) + '</span><span class="s-name">' + esc(s[1]) + '</span>' +
        (s[2] ? '<span class="s-tag">escrito</span>' : '<span class="s-tag">cripto</span>');
      el.addEventListener('click', function () {
        closeModals();
        loadSymbol(s[0], state.interval);
      });
      list.appendChild(el);
    });
    if (!matches.length) {
      list.innerHTML = '<div class="sym-item"><span class="s-name">Sin resultados. Escribe un par completo, p. ej. BTCUSDT.</span></div>';
    }
  }
  $('#sym-q').addEventListener('input', buildSymList);
  $('#sym-q').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') {
      var first = $('#sym-list .sym-item .s-sym');
      if (first) { closeModals(); loadSymbol(first.textContent, state.interval); }
    }
  });
  $('#ind-q').addEventListener('input', buildIndModal);

  // ---------- barra superior ----------
  $('#btn-symbol').addEventListener('click', function () { openModal('#modal-symbol'); });
  $('#btn-indicators').addEventListener('click', function () { openModal('#modal-ind'); });
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
      loadSymbol(state.symbol, b.dataset.tf);
    });
  });
  $('#tf-extra').addEventListener('change', function () {
    if (!this.value) return;
    setActiveTf(this.value);
    loadSymbol(state.symbol, this.value);
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
    var cv = chart.snapshot(state.symbol + ' · ' + state.interval.toUpperCase() + ' — LibreCharts');
    cv.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = state.symbol + '_' + state.interval + '.png';
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
  function renderWatchlist() {
    var box = $('#watchlist');
    box.innerHTML = '';
    state.watchlist.forEach(function (sym) {
      var el = document.createElement('div');
      el.className = 'wl-item' + (sym === state.symbol ? ' active' : '');
      el.dataset.sym = sym;
      var p = wlPrices[sym];
      el.innerHTML =
        '<span class="wl-sym">' + esc(sym) + '</span>' +
        '<span class="wl-px">' + (p ? TV.fmtN(p.px, TV.decimalsFor(p.px)) : '—') + '</span>' +
        '<span class="wl-chg ' + (p && p.pct < 0 ? 'down' : 'up') + '">' + (p ? (p.pct >= 0 ? '+' : '') + p.pct.toFixed(2) + '%' : '') + '</span>' +
        '<button class="wl-del" title="Quitar">✕</button>';
      el.addEventListener('click', function (ev) {
        if (ev.target.classList.contains('wl-del')) {
          state.watchlist = state.watchlist.filter(function (s) { return s !== sym; });
          renderWatchlist();
          startTickers();
          persist();
          return;
        }
        loadSymbol(sym, state.interval);
      });
      box.appendChild(el);
    });
  }

  function startTickers() {
    tickers.demo = feed.demoMode;
    tickers.onTick = function (sym, px, pct) {
      var prev = wlPrices[sym];
      wlPrices[sym] = { px: px, pct: pct };
      var el = document.querySelector('.wl-item[data-sym="' + sym + '"]');
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
    tickers.watch(state.watchlist);
  }

  function addToWatchlist() {
    var v = ($('#wl-input').value || '').toUpperCase().trim();
    if (!v) return;
    if (!/^[A-Z0-9]{5,14}$/.test(v)) { toast('Símbolo no válido'); return; }
    if (state.watchlist.indexOf(v) < 0) {
      state.watchlist.push(v);
      renderWatchlist();
      startTickers();
      persist();
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

  loadSymbol(state.symbol, state.interval);

  // los tickers necesitan saber si estamos en modo demo: espera a la primera carga
  var tickerStart = setInterval(function () {
    if (chart.candles.length) {
      clearInterval(tickerStart);
      startTickers();
    }
  }, 700);

  window.App = { chart: chart, feed: feed, state: state, addIndicator: addIndicator };
})();
