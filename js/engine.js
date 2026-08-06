/* LibreCharts — motor de gráficos sobre canvas.
 * Sin dependencias. Paneles ilimitados: el lienzo crece y el contenedor
 * hace scroll cuando los osciladores no caben en pantalla. */
(function () {
  'use strict';
  window.TV = window.TV || {};

  var THEMES = {
    dark: {
      bg: '#131722', grid: '#1c2030', gridStrong: '#232838', text: '#787b86', textStrong: '#d1d4dc',
      up: '#26a69a', down: '#ef5350', border: '#2a2e39', axisBg: '#131722',
      crossLine: '#758696', crossLabelBg: '#363a45', crossLabelFg: '#ffffff',
      watermark: 'rgba(120,123,134,0.09)', selection: '#2962ff',
      areaLine: '#2962ff', sepLine: '#2a2e39', resizeHot: 'rgba(41,98,255,0.55)'
    },
    light: {
      bg: '#ffffff', grid: '#f0f3fa', gridStrong: '#e4e8f0', text: '#787b86', textStrong: '#131722',
      up: '#26a69a', down: '#ef5350', border: '#e0e3eb', axisBg: '#ffffff',
      crossLine: '#9598a1', crossLabelBg: '#4c525e', crossLabelFg: '#ffffff',
      watermark: 'rgba(80,83,94,0.08)', selection: '#2962ff',
      areaLine: '#2962ff', sepLine: '#e0e3eb', resizeHot: 'rgba(41,98,255,0.55)'
    }
  };

  var PALETTE = ['#2962ff', '#ff6d00', '#26c6da', '#ab47bc', '#66bb6a', '#ffca28', '#ef5350',
    '#5c6bc0', '#ec407a', '#00e676', '#e040fb', '#29b6f6', '#ff7043', '#9ccc65', '#7e57c2'];

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  var FIB_COLORS = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86'];

  // Clics que necesita cada herramienta para quedar definida.
  var TOOL_POINTS = {
    trend: 2, ray: 2, extline: 2, rect: 2, ellipse: 2, arrow: 2, fib: 2,
    ruler: 2, position: 2, channel: 3,
    hline: 1, hray: 1, vline: 1, text: 1
  };

  // ---------- utilidades ----------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function decimalsFor(p) {
    p = Math.abs(p);
    if (!isFinite(p) || p === 0) return 2;
    if (p >= 100) return 2;
    if (p >= 10) return 3;
    if (p >= 1) return 4;
    if (p >= 0.1) return 5;
    if (p >= 0.01) return 6;
    if (p >= 0.001) return 7;
    return 8;
  }

  // Formato argentino: punto para los miles y coma para los decimales.
  function fmtN(v, dec) {
    if (v == null || !isFinite(v)) return '—';
    var neg = v < 0;
    var parts = Math.abs(v).toFixed(dec).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + parts.join(',');
  }

  function fmtVol(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1e9) return fmtN(v / 1e9, 2) + ' B';
    if (a >= 1e6) return fmtN(v / 1e6, 2) + ' M';
    if (a >= 1e3) return fmtN(v / 1e3, 2) + ' K';
    return fmtN(v, 2);
  }

  function niceStep(raw) {
    if (raw <= 0 || !isFinite(raw)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var s = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return s * mag;
  }

  function hexA(hex, a) {
    if (!hex) return 'rgba(120,120,120,' + a + ')';
    var m = /^#?([0-9a-f]{6})/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ---------- escala Y de un panel ----------
  /* Trabaja en "espacio transformado": normal, logarítmico o porcentaje.
     El resto del motor le pasa precios y no se entera del modo. */
  function Scale(min, max, top, h, padTop, padBot, opts) {
    opts = opts || {};
    this.mode = opts.mode || 'normal';
    this.base = opts.base || null;
    this.flip = !!opts.flip;
    if (this.mode === 'log' && (min <= 0 || max <= 0)) this.mode = 'normal';
    if (this.mode === 'percent' && !this.base) this.mode = 'normal';

    this.pmin = min; this.pmax = max;
    this.tmin = this.tf(min); this.tmax = this.tf(max);
    this.top = top; this.h = h;
    this.pt = padTop == null ? 8 : padTop;
    this.pb = padBot == null ? 8 : padBot;
  }
  Scale.prototype.tf = function (v) {
    if (this.mode === 'log') return Math.log(Math.max(v, 1e-12));
    if (this.mode === 'percent') return (v / this.base - 1) * 100;
    return v;
  };
  Scale.prototype.itf = function (t) {
    if (this.mode === 'log') return Math.exp(t);
    if (this.mode === 'percent') return this.base * (1 + t / 100);
    return t;
  };
  Scale.prototype.y = function (v) {
    var inner = this.h - this.pt - this.pb;
    if (this.tmax === this.tmin) return this.top + this.pt + inner / 2;
    var f = (this.tmax - this.tf(v)) / (this.tmax - this.tmin);
    if (this.flip) f = 1 - f;
    return this.top + this.pt + f * inner;
  };
  Scale.prototype.invert = function (py) {
    var inner = this.h - this.pt - this.pb;
    if (inner <= 0) return this.pmin;
    var f = (py - this.top - this.pt) / inner;
    if (this.flip) f = 1 - f;
    return this.itf(this.tmax - f * (this.tmax - this.tmin));
  };
  // Precios donde conviene poner una línea de la grilla.
  Scale.prototype.ticks = function (approx) {
    var out = [];
    if (this.mode === 'log') {
      // En logarítmica leen mejor los valores redondos 1 / 2 / 5 por década.
      var e0 = Math.floor(Math.log10(this.pmin)), e1 = Math.ceil(Math.log10(this.pmax));
      for (var e = e0; e <= e1; e++) {
        for (var mi = 0; mi < 3; mi++) {
          var v = [1, 2, 5][mi] * Math.pow(10, e);
          if (v >= this.pmin && v <= this.pmax) out.push(v);
        }
      }
      if (out.length >= 3) return out;
      out = [];
    }
    var step = niceStep((this.tmax - this.tmin) / Math.max(2, approx));
    var start = Math.ceil(this.tmin / step) * step;
    for (var t = start; t <= this.tmax + step * 0.001; t += step) out.push(this.itf(t));
    return out;
  };

  // ---------- gráfico ----------
  function Chart(mount, opts) {
    var self = this;
    this.opts = opts || {};
    this.mount = mount;
    this.theme = THEMES[this.opts.theme || 'dark'];

    this.stack = document.createElement('div');
    this.stack.className = 'chart-stack';
    this.canvas = document.createElement('canvas');
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'overlay';
    this.stack.appendChild(this.canvas);
    this.stack.appendChild(this.overlay);
    mount.appendChild(this.stack);
    this.ctx = this.canvas.getContext('2d');
    this.octx = this.overlay.getContext('2d');

    // datos
    this.candles = [];
    this.active = [];
    this.display = [];
    this.symbol = '';
    this.interval = '1h';
    this.intervalMs = 3600e3;
    this.type = 'candles';
    this.decimals = 2;
    this.dataVersion = 0;
    this.replayAt = null;

    // presentación
    this.tz = 'America/Argentina/Buenos_Aires';
    this.scaleMode = 'normal';
    this.flipScale = false;
    this.showGrid = true;
    this.showWatermark = true;
    this.showLastLine = true;
    this.showCountdown = true;
    this.precision = null;
    this.colors = { up: null, down: null };

    // vista
    this.barW = 8;
    this.rightIndex = 0;
    this.scaleW = 78;
    this.axisH = 30;
    this.paneSizes = {};

    // indicadores
    this.indicators = [];
    this._colorIdx = 0;

    // dibujos
    this.drawings = [];
    this.tool = 'cursor';
    this.selection = null;
    this._drawState = null;
    this.magnet = 'off';          // 'off' | 'weak' | 'strong'
    this.keepDrawing = false;
    this.drawingsLocked = false;
    this.drawingsHidden = false;
    this.drawStyle = { color: '#2962ff', width: 2, dash: null };
    this._undo = [];
    this._redo = [];

    // interacción
    this._mouse = null;
    this._pan = null;
    this._pinch = null;
    this._resizePane = null;
    this._dragDraw = null;
    this._dirty = false;
    this._layoutSig = '';
    this._paneRects = [];
    this._mainScale = null;
    this._hasMoreHistory = true;
    this._loadingHistory = false;

    this._bindEvents();

    this._ro = new ResizeObserver(function () { self.resize(); });
    this._ro.observe(mount);
    this.resize();

    this._raf = function () {
      if (self._dirty) { self._dirty = false; self._render(); }
      requestAnimationFrame(self._raf);
    };
    requestAnimationFrame(this._raf);

    // La cuenta regresiva de la vela necesita repintar cada segundo.
    setInterval(function () {
      if (self.showCountdown && self.active.length && self.intervalMs < 86400e3) self.requestRender();
    }, 1000);
  }

  Chart.prototype.requestRender = function () { this._dirty = true; };

  Chart.prototype.setTheme = function (name) {
    this.theme = THEMES[name] || THEMES.dark;
    this.requestRender();
  };

  Chart.prototype.nextColor = function () {
    return PALETTE[this._colorIdx++ % PALETTE.length];
  };

  Chart.prototype.upColor = function () { return this.colors.up || this.theme.up; };
  Chart.prototype.downColor = function () { return this.colors.down || this.theme.down; };

  // Fecha desplazada a la zona horaria elegida: después se lee con getUTC*.
  Chart.prototype._d = function (ms) {
    var off = 0;
    if (TV.Market && this.tz && this.tz !== 'UTC') {
      try { off = TV.Market.tzOffset(this.tz, ms); } catch (e) { off = 0; }
    }
    return new Date(ms + off);
  };

  // ---------- datos ----------
  Chart.prototype.setData = function (candles, symbol, interval, intervalMs) {
    this.candles = candles || [];
    this.symbol = symbol || this.symbol;
    this.interval = interval || this.interval;
    this.intervalMs = intervalMs || this.intervalMs;
    this.replayAt = null;
    this.dataVersion++;
    this._hasMoreHistory = true;
    this._loadingHistory = false;
    var last = this.candles[this.candles.length - 1];
    this.decimals = this.precision != null ? this.precision : (last ? decimalsFor(last.close) : 2);
    this._rebuildDisplay();
    this.resetView();
  };

  Chart.prototype.prepend = function (older) {
    if (!older || !older.length) { this._hasMoreHistory = false; return; }
    var firstT = this.candles.length ? this.candles[0].time : Infinity;
    var add = older.filter(function (k) { return k.time < firstT; });
    if (!add.length) { this._hasMoreHistory = false; return; }
    this.candles = add.concat(this.candles);
    if (this.replayAt != null) this.replayAt += add.length;
    this.rightIndex += add.length;
    this.dataVersion++;
    this._rebuildDisplay();
    this.requestRender();
  };

  Chart.prototype.mergeLive = function (k) {
    if (this.replayAt != null) return;   // en reproducción no entran datos nuevos
    var n = this.candles.length;
    if (!n) return;
    var last = this.candles[n - 1];
    if (k.time === last.time) {
      this.candles[n - 1] = k;
    } else if (k.time > last.time) {
      var pinned = this.rightIndex >= n - 1;
      this.candles.push(k);
      if (pinned) this.rightIndex += 1;
    } else return;
    this.dataVersion++;
    this._rebuildDisplay();
    this.requestRender();
  };

  Chart.prototype._rebuildDisplay = function () {
    var src = this.replayAt != null
      ? this.candles.slice(0, Math.max(1, Math.min(this.replayAt + 1, this.candles.length)))
      : this.candles;
    this.active = src;

    if (this.type !== 'heikin') { this.display = src; return; }
    var out = new Array(src.length), po = null, pc = null;
    for (var i = 0; i < src.length; i++) {
      var k = src[i];
      var hc = (k.open + k.high + k.low + k.close) / 4;
      var ho = i === 0 ? (k.open + k.close) / 2 : (po + pc) / 2;
      out[i] = {
        time: k.time, open: ho, close: hc,
        high: Math.max(k.high, ho, hc), low: Math.min(k.low, ho, hc),
        volume: k.volume
      };
      po = ho; pc = hc;
    }
    this.display = out;
  };

  Chart.prototype.setType = function (t) {
    this.type = t;
    this._rebuildDisplay();
    this.requestRender();
  };

  Chart.prototype.setScaleMode = function (m) { this.scaleMode = m; this.requestRender(); };
  Chart.prototype.setTimezone = function (tz) { this.tz = tz; this.requestRender(); };

  // ---------- reproducción de barras ----------
  Chart.prototype.startReplay = function (idx) {
    if (!this.candles.length) return;
    this.replayAt = clamp(idx == null ? Math.floor(this.candles.length * 0.7) : idx,
      10, this.candles.length - 1);
    this.dataVersion++;
    this._rebuildDisplay();
    this.requestRender();
    if (this.opts.onReplay) this.opts.onReplay(this.replayAt, this.candles.length);
  };
  Chart.prototype.stepReplay = function (n) {
    if (this.replayAt == null) return false;
    var atEnd = this.replayAt + (n || 1) >= this.candles.length - 1;
    this.replayAt = Math.min(this.replayAt + (n || 1), this.candles.length - 1);
    this.dataVersion++;
    this._rebuildDisplay();
    this.rightIndex = this.active.length - 1 + Math.max(4, Math.round(this._plotW() / this.barW * 0.06));
    this.requestRender();
    if (this.opts.onReplay) this.opts.onReplay(this.replayAt, this.candles.length);
    return !atEnd;
  };
  Chart.prototype.stopReplay = function () {
    this.replayAt = null;
    this.dataVersion++;
    this._rebuildDisplay();
    this.requestRender();
    if (this.opts.onReplay) this.opts.onReplay(null, this.candles.length);
  };

  // ---------- indicadores ----------
  Chart.prototype.addIndicator = function (key, params, colors) {
    var def = TV.Indicators.byKey[key];
    if (!def) return null;
    var p = {}, col = {};
    def.params.forEach(function (pd) { p[pd.k] = (params && params[pd.k] != null) ? params[pd.k] : pd.def; });
    var self = this;
    def.colors.forEach(function (cd) {
      col[cd.k] = (colors && colors[cd.k]) || cd.def || self.nextColor();
    });
    var ins = {
      id: 'i' + (++Chart._seq),
      key: key, def: def, params: p, colors: col,
      visible: true, result: null, _v: -1
    };
    this.indicators.push(ins);
    this._indChanged();
    return ins;
  };
  Chart._seq = 0;

  Chart.prototype._indChanged = function () {
    this.resize();
    if (this.opts.onIndicatorsChange) this.opts.onIndicatorsChange();
  };

  Chart.prototype.updateIndicator = function (id, params, colors) {
    var ins = this.indicators.find(function (i) { return i.id === id; });
    if (!ins) return;
    if (params) Object.keys(params).forEach(function (k) { ins.params[k] = params[k]; });
    if (colors) Object.keys(colors).forEach(function (k) { ins.colors[k] = colors[k]; });
    ins._v = -1;
    this._indChanged();
  };

  Chart.prototype.toggleIndicator = function (id) {
    var ins = this.indicators.find(function (i) { return i.id === id; });
    if (!ins) return;
    ins.visible = !ins.visible;
    this._indChanged();
  };

  Chart.prototype.removeIndicator = function (id) {
    this.indicators = this.indicators.filter(function (i) { return i.id !== id; });
    delete this.paneSizes[id];
    this._indChanged();
  };

  Chart.prototype.clearIndicators = function () {
    this.indicators = [];
    this.paneSizes = {};
    this._indChanged();
  };

  Chart.prototype._ensureComputed = function () {
    var self = this;
    this.indicators.forEach(function (ins) {
      if (ins._v !== self.dataVersion) {
        ins.result = TV.Indicators.compute(ins.key, self.active, ins.params, { intervalMs: self.intervalMs });
        ins._v = self.dataVersion;
      }
    });
  };

  Chart.prototype.indicatorLabel = function (ins) {
    var nums = ins.def.params
      .filter(function (p) { return p.type !== 'source'; })
      .map(function (p) { return ins.params[p.k]; });
    return ins.def.short + (nums.length ? ' (' + nums.join(', ') + ')' : '');
  };

  Chart.prototype.indicatorValuesAt = function (ins, idx) {
    if (!ins.result) return [];
    var out = [];
    var isVol = ins.result.isVolume;
    ins.result.outputs.forEach(function (o) {
      if (o.kind === 'fill' || o.kind === 'cloud') return;
      var v = o.values && idx != null && idx >= 0 && idx < o.values.length ? o.values[idx] : null;
      var color = o.colorKey ? ins.colors[o.colorKey] : (v != null && v >= 0 ? ins.colors[o.upKey] : ins.colors[o.dnKey]);
      out.push({ v: v, color: color, vol: !!isVol });
    });
    return out;
  };

  // ---------- geometría ----------
  Chart.prototype._plotW = function () {
    return Math.max(50, (this.mount.clientWidth || 300) - this.scaleW);
  };

  Chart.prototype.xAt = function (i) { return this._plotW() - (this.rightIndex - i) * this.barW; };
  Chart.prototype.indexAt = function (x) { return this.rightIndex - (this._plotW() - x) / this.barW; };

  Chart.prototype.timeForIndex = function (fi) {
    var c = this.active, n = c.length;
    if (!n) return 0;
    var i = Math.floor(fi), fr = fi - i;
    if (i < 0) return c[0].time + fi * this.intervalMs;
    if (i >= n - 1) return c[n - 1].time + (fi - (n - 1)) * this.intervalMs;
    return c[i].time + fr * (c[i + 1].time - c[i].time);
  };

  Chart.prototype.indexForTime = function (t) {
    var c = this.active, n = c.length;
    if (!n) return 0;
    if (t <= c[0].time) return (t - c[0].time) / this.intervalMs;
    if (t >= c[n - 1].time) return n - 1 + (t - c[n - 1].time) / this.intervalMs;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (c[mid].time <= t) lo = mid; else hi = mid;
    }
    var span = c[hi].time - c[lo].time;
    return lo + (span > 0 ? (t - c[lo].time) / span : 0);
  };

  Chart.prototype.resize = function () {
    var w = this.mount.clientWidth || 300;
    this._computeLayout();
    var h = this._canvasH;
    var dpr = window.devicePixelRatio || 1;
    [this.canvas, this.overlay].forEach(function (cv) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
    });
    this.stack.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.requestRender();
  };

  Chart.prototype._computeLayout = function () {
    var availH = this.mount.clientHeight || 400;
    var oscs = this.indicators.filter(function (i) { return i.def.cat === 'oscillator' && i.visible; });
    var defOsc = clamp(Math.round(availH * 0.16), 90, 150);

    var self = this;
    var oscHeights = oscs.map(function (ins) { return self.paneSizes[ins.id] || defOsc; });
    var totalOsc = oscHeights.reduce(function (a, b) { return a + b; }, 0);

    var minMainH = Math.min(300, Math.max(160, availH - this.axisH - defOsc));
    var mainH = this.paneSizes.main || Math.max(minMainH, availH - this.axisH - totalOsc);

    this._canvasH = mainH + totalOsc + this.axisH;
    var rects = [{ kind: 'main', id: 'main', top: 0, h: mainH }];
    var y = mainH;
    oscs.forEach(function (ins, i) {
      rects.push({ kind: 'ind', id: ins.id, ins: ins, top: y, h: oscHeights[i] });
      y += oscHeights[i];
    });
    this._paneRects = rects;

    var sig = rects.map(function (r) { return r.id + ':' + r.top + ':' + r.h; }).join('|');
    if (sig !== this._layoutSig) {
      this._layoutSig = sig;
      if (this.opts.onLayout) this.opts.onLayout(rects);
    }
  };

  // Índice del panel cuyo borde superior está a menos de 4 px de y.
  Chart.prototype._separatorAt = function (y) {
    for (var i = 1; i < this._paneRects.length; i++) {
      if (Math.abs(y - this._paneRects[i].top) <= 4) return i;
    }
    return -1;
  };

  // ---------- render principal ----------
  Chart.prototype._render = function () {
    var ctx = this.ctx, th = this.theme;
    var W = this.mount.clientWidth || 300;
    this._computeLayout();
    var H = this._canvasH;
    if (Math.abs(parseInt(this.canvas.style.height, 10) - H) > 1) { this.resize(); return; }

    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);

    var n = this.active.length;
    if (!n) { this._renderCrosshair(); return; }

    this._ensureComputed();

    var plotW = this._plotW();
    this.rightIndex = clamp(this.rightIndex, 4, n - 1 + plotW / this.barW * 0.85);

    var i1 = Math.min(n + 400, Math.ceil(this.rightIndex) + 1);
    var i0 = Math.floor(this.rightIndex - plotW / this.barW) - 1;
    var v0 = Math.max(0, i0), v1 = Math.min(n - 1, i1);

    if (v0 < 60 && this._hasMoreHistory && !this._loadingHistory && this.opts.onNeedHistory && this.replayAt == null) {
      this._loadingHistory = true;
      this.opts.onNeedHistory();
    }

    var timeTicks = this._timeTicks(i0, i1, plotW);
    var self = this;

    this._paneRects.forEach(function (pane, pi) {
      if (pane.kind === 'main') self._renderMain(pane, i0, i1, v0, v1, plotW, timeTicks);
      else self._renderOsc(pane, i0, i1, v0, v1, plotW, timeTicks);
      if (pi > 0) {
        ctx.strokeStyle = th.sepLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, pane.top + 0.5);
        ctx.lineTo(W, pane.top + 0.5);
        ctx.stroke();
      }
    });

    this._renderTimeAxis(timeTicks, plotW, W, H);

    ctx.strokeStyle = th.border;
    ctx.beginPath();
    ctx.moveTo(plotW + 0.5, 0);
    ctx.lineTo(plotW + 0.5, H - this.axisH);
    ctx.stroke();

    this._renderCrosshair();
    if (this.opts.onRendered) this.opts.onRendered();
  };

  Chart.prototype._timeTicks = function (i0, i1, plotW) {
    var out = [];
    var n = this.active.length;
    if (!n) return out;
    var ms = this.intervalMs;
    var units = [60e3, 120e3, 300e3, 600e3, 900e3, 1800e3, 3600e3, 7200e3, 14400e3, 21600e3, 43200e3,
      86400e3, 172800e3, 604800e3, 'M1', 'M3', 'Y1'];
    var unit = null;
    for (var u = 0; u < units.length; u++) {
      var um = units[u];
      var umMs = um === 'M1' ? 2592000e3 : um === 'M3' ? 7776000e3 : um === 'Y1' ? 31536000e3 : um;
      if (umMs / ms * this.barW >= 78) { unit = um; break; }
    }
    if (unit == null) unit = 'Y1';

    var from = Math.max(0, i0), to = Math.min(n - 1, i1);
    for (var i = from; i <= to; i++) {
      var t = this.active[i].time;
      var d = this._d(t);
      var prevD = i > 0 ? this._d(this.active[i - 1].time) : null;
      var hit = false, strong = false, label = '';

      if (unit === 'M1' || unit === 'M3' || unit === 'Y1') {
        var newMonth = !prevD || prevD.getUTCMonth() !== d.getUTCMonth();
        if (unit === 'Y1') { hit = newMonth && d.getUTCMonth() === 0; strong = true; label = '' + d.getUTCFullYear(); }
        else if (unit === 'M3') { hit = newMonth && d.getUTCMonth() % 3 === 0; label = d.getUTCMonth() === 0 ? '' + d.getUTCFullYear() : MESES[d.getUTCMonth()]; strong = d.getUTCMonth() === 0; }
        else { hit = newMonth; label = d.getUTCMonth() === 0 ? '' + d.getUTCFullYear() : MESES[d.getUTCMonth()]; strong = d.getUTCMonth() === 0; }
      } else if (unit >= 86400e3) {
        var newDay = !prevD || prevD.getUTCDate() !== d.getUTCDate();
        var days = Math.round(unit / 86400e3);
        hit = newDay && (days === 1 || Math.floor(t / 86400e3) % days === 0);
        if (hit) {
          if (d.getUTCDate() === 1) { label = d.getUTCMonth() === 0 ? '' + d.getUTCFullYear() : MESES[d.getUTCMonth()]; strong = true; }
          else label = '' + d.getUTCDate();
        }
      } else {
        // El corte se evalúa en hora local para que caiga en horas redondas.
        var localMs = d.getTime();
        hit = localMs % unit === 0;
        if (hit) {
          if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
            label = d.getUTCDate() + ' ' + MESES[d.getUTCMonth()];
            strong = true;
          } else {
            label = ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
          }
        }
      }
      if (hit) {
        var x = this.xAt(i) + this.barW / 2;
        if (x >= -40 && x <= plotW + 40) out.push({ x: x, label: label, strong: strong });
      }
    }
    return out;
  };

  Chart.prototype._priceGrid = function (ctx, scale, plotW, dec, fmt) {
    var th = this.theme;
    var inner = scale.h - scale.pt - scale.pb;
    if (inner <= 0) return;
    var ticks = scale.ticks(Math.max(2, inner / 55));
    ctx.font = '10px -apple-system, sans-serif';
    var self = this;
    ticks.forEach(function (v) {
      var y = Math.round(scale.y(v)) + 0.5;
      if (y < scale.top + 2 || y > scale.top + scale.h - 2) return;
      if (self.showGrid) {
        ctx.strokeStyle = th.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotW, y);
        ctx.stroke();
      }
      ctx.fillStyle = th.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      var label = fmt ? fmt(v) : (scale.mode === 'percent'
        ? fmtN((v / scale.base - 1) * 100, 2) + '%'
        : fmtN(v, dec));
      ctx.fillText(label, plotW + 6, y);
    });
  };

  Chart.prototype._vGrid = function (ctx, ticks, top, h) {
    if (!this.showGrid) return;
    var th = this.theme;
    ticks.forEach(function (t) {
      ctx.strokeStyle = t.strong ? th.gridStrong : th.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(t.x) + 0.5, top);
      ctx.lineTo(Math.round(t.x) + 0.5, top + h);
      ctx.stroke();
    });
  };

  Chart.prototype._renderMain = function (pane, i0, i1, v0, v1, plotW, timeTicks) {
    var ctx = this.ctx, th = this.theme;
    var d = this.display;
    var self = this;

    var min = Infinity, max = -Infinity, i, v;
    if (this.type === 'line' || this.type === 'area') {
      for (i = v0; i <= v1; i++) { v = d[i].close; if (v < min) min = v; if (v > max) max = v; }
    } else {
      for (i = v0; i <= v1; i++) {
        if (d[i].low < min) min = d[i].low;
        if (d[i].high > max) max = d[i].high;
      }
    }
    this.indicators.forEach(function (ins) {
      if (ins.def.cat !== 'overlay' || !ins.visible || !ins.result) return;
      ins.result.outputs.forEach(function (o) {
        if (!o.values) return;
        var lim = Math.min(o.values.length - 1, i1);
        for (var j = Math.max(0, i0); j <= lim; j++) {
          var x = o.values[j];
          if (x == null || !isFinite(x)) continue;
          if (x < min) min = x;
          if (x > max) max = x;
        }
      });
    });
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (max === min) { max += Math.abs(max) * 0.01 + 1e-9; min -= Math.abs(min) * 0.01 + 1e-9; }

    var baseK = d[Math.max(0, v0)];
    var scale = new Scale(min, max, pane.top, pane.h, 14, 14, {
      mode: this.scaleMode, base: baseK ? baseK.close : null, flip: this.flipScale
    });
    this._mainScale = scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pane.top, plotW + this.scaleW, pane.h);
    ctx.clip();

    if (this.showWatermark) {
      ctx.font = '700 ' + Math.min(60, pane.h / 5) + 'px -apple-system, sans-serif';
      ctx.fillStyle = th.watermark;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.symbol + ' · ' + this.interval.toUpperCase(), plotW / 2, pane.top + pane.h / 2);
    }

    this._vGrid(ctx, timeTicks, pane.top, pane.h);
    this._priceGrid(ctx, scale, plotW, this.decimals);

    ctx.beginPath();
    ctx.rect(0, pane.top, plotW, pane.h);
    ctx.clip();

    this.indicators.forEach(function (ins) {
      if (ins.def.cat !== 'overlay' || !ins.visible || !ins.result) return;
      self._renderFills(ctx, ins, scale, i0, i1);
    });

    var upC = this.upColor(), dnC = this.downColor();
    var bodyW = Math.max(1, this.barW * 0.72);
    if (this.type === 'candles' || this.type === 'heikin') {
      for (i = v0; i <= v1; i++) {
        var k = d[i];
        var x = this.xAt(i) + this.barW / 2;
        var col = k.close >= k.open ? upC : dnC;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = Math.max(1, this.barW * 0.1);
        ctx.beginPath();
        ctx.moveTo(x, scale.y(k.high));
        ctx.lineTo(x, scale.y(k.low));
        ctx.stroke();
        var yO = scale.y(k.open), yC = scale.y(k.close);
        ctx.fillRect(x - bodyW / 2, Math.min(yO, yC), bodyW, Math.max(1, Math.abs(yC - yO)));
      }
    } else if (this.type === 'bars') {
      ctx.lineWidth = Math.max(1, Math.min(2, this.barW * 0.15));
      for (i = v0; i <= v1; i++) {
        var kb = d[i];
        var xb = this.xAt(i) + this.barW / 2;
        ctx.strokeStyle = kb.close >= kb.open ? upC : dnC;
        ctx.beginPath();
        ctx.moveTo(xb, scale.y(kb.high));
        ctx.lineTo(xb, scale.y(kb.low));
        ctx.moveTo(xb - bodyW / 2, scale.y(kb.open));
        ctx.lineTo(xb, scale.y(kb.open));
        ctx.moveTo(xb, scale.y(kb.close));
        ctx.lineTo(xb + bodyW / 2, scale.y(kb.close));
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      var started = false;
      for (i = v0; i <= v1; i++) {
        var xl = this.xAt(i) + this.barW / 2;
        var yl = scale.y(d[i].close);
        if (!started) { ctx.moveTo(xl, yl); started = true; } else ctx.lineTo(xl, yl);
      }
      if (this.type === 'area' && started) {
        var grad = ctx.createLinearGradient(0, pane.top, 0, pane.top + pane.h);
        grad.addColorStop(0, hexA(th.areaLine, 0.28));
        grad.addColorStop(1, hexA(th.areaLine, 0));
        ctx.save();
        ctx.lineTo(this.xAt(v1) + this.barW / 2, pane.top + pane.h);
        ctx.lineTo(this.xAt(v0) + this.barW / 2, pane.top + pane.h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        started = false;
        for (i = v0; i <= v1; i++) {
          var xa = this.xAt(i) + this.barW / 2;
          var ya = scale.y(d[i].close);
          if (!started) { ctx.moveTo(xa, ya); started = true; } else ctx.lineTo(xa, ya);
        }
      }
      ctx.strokeStyle = th.areaLine;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    this.indicators.forEach(function (ins) {
      if (ins.def.cat !== 'overlay' || !ins.visible || !ins.result) return;
      self._renderOutputs(ctx, ins, scale, i0, i1, null);
    });

    if (!this.drawingsHidden) this._renderDrawings(ctx, scale, plotW, pane);

    ctx.restore();

    var lastD = d[d.length - 1];
    var lastRaw = this.active[this.active.length - 1];
    if (lastD && this.showLastLine) {
      var yLast = scale.y(lastD.close);
      if (yLast > pane.top && yLast < pane.top + pane.h) {
        var colLast = lastRaw.close >= lastRaw.open ? upC : dnC;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, pane.top, plotW, pane.h);
        ctx.clip();
        ctx.strokeStyle = colLast;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(0, Math.round(yLast) + 0.5);
        ctx.lineTo(plotW, Math.round(yLast) + 0.5);
        ctx.stroke();
        ctx.restore();

        var txt = this.scaleMode === 'percent' && scale.base
          ? fmtN((lastD.close / scale.base - 1) * 100, 2) + '%'
          : fmtN(lastD.close, this.decimals);
        this._axisLabel(ctx, plotW, yLast, txt, colLast, '#fff');

        if (this.showCountdown && this.replayAt == null) {
          var rest = this._barCountdown();
          if (rest) this._axisLabel(ctx, plotW, yLast + 19, rest, th.crossLabelBg, th.crossLabelFg);
        }
      }
    }
  };

  // Tiempo que falta para que cierre la vela en curso.
  Chart.prototype._barCountdown = function () {
    var last = this.active[this.active.length - 1];
    if (!last || this.intervalMs >= 86400e3) return null;
    var left = last.time + this.intervalMs - Date.now();
    if (left < 0 || left > this.intervalMs) return null;
    var s = Math.floor(left / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + ss).slice(-2);
  };

  Chart.prototype._renderFills = function (ctx, ins, scale, i0, i1) {
    var self = this;
    var byOut = {};
    ins.result.outputs.forEach(function (o) { if (o.key) byOut[o.key] = o; });
    ins.result.outputs.forEach(function (o) {
      if (o.kind !== 'fill' && o.kind !== 'cloud') return;
      var A = byOut[o.a], B = byOut[o.b];
      if (!A || !B) return;
      var from = Math.max(0, i0), to = Math.min(Math.max(A.values.length, B.values.length) - 1, i1);
      if (o.kind === 'fill') {
        ctx.fillStyle = hexA(ins.colors[o.colorKey], 0.09);
        self._fillBetween(ctx, A.values, B.values, scale, from, to, function () { return true; });
      } else {
        ctx.fillStyle = hexA(ins.colors[o.colorUpKey], 0.13);
        self._fillBetween(ctx, A.values, B.values, scale, from, to, function (a, b) { return a >= b; });
        ctx.fillStyle = hexA(ins.colors[o.colorDnKey], 0.13);
        self._fillBetween(ctx, A.values, B.values, scale, from, to, function (a, b) { return a < b; });
      }
    });
  };

  Chart.prototype._fillBetween = function (ctx, va, vb, scale, from, to, pred) {
    var runA = [], runB = [];
    var self = this;
    function flush() {
      if (runA.length < 2) { runA = []; runB = []; return; }
      ctx.beginPath();
      ctx.moveTo(runA[0][0], runA[0][1]);
      for (var i = 1; i < runA.length; i++) ctx.lineTo(runA[i][0], runA[i][1]);
      for (var j = runB.length - 1; j >= 0; j--) ctx.lineTo(runB[j][0], runB[j][1]);
      ctx.closePath();
      ctx.fill();
      runA = []; runB = [];
    }
    for (var i = from; i <= to; i++) {
      var a = va[i], b = vb[i];
      if (a == null || b == null || !isFinite(a) || !isFinite(b) || !pred(a, b)) { flush(); continue; }
      var x = self.xAt(i) + self.barW / 2;
      runA.push([x, scale.y(a)]);
      runB.push([x, scale.y(b)]);
    }
    flush();
  };

  Chart.prototype._renderOutputs = function (ctx, ins, scale, i0, i1, zeroY) {
    var self = this;
    var bodyW = Math.max(1, this.barW * 0.72);
    ins.result.outputs.forEach(function (o) {
      if (o.kind === 'line') {
        ctx.strokeStyle = ins.colors[o.colorKey] || '#888';
        ctx.lineWidth = o.width || 1.5;
        ctx.lineJoin = 'round';
        if (o.dash) ctx.setLineDash(o.dash); else ctx.setLineDash([]);
        ctx.beginPath();
        var pen = false;
        var lim = Math.min(o.values.length - 1, i1);
        for (var i = Math.max(0, i0); i <= lim; i++) {
          var v = o.values[i];
          if (v == null || !isFinite(v)) { pen = false; continue; }
          var x = self.xAt(i) + self.barW / 2, y = scale.y(v);
          if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (o.kind === 'dots') {
        ctx.fillStyle = ins.colors[o.colorKey] || '#888';
        var r = Math.max(1.2, Math.min(3, self.barW * 0.16));
        var limD = Math.min(o.values.length - 1, i1);
        for (var j = Math.max(0, i0); j <= limD; j++) {
          var vd = o.values[j];
          if (vd == null || !isFinite(vd)) continue;
          ctx.beginPath();
          ctx.arc(self.xAt(j) + self.barW / 2, scale.y(vd), r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (o.kind === 'hist') {
        var y0 = zeroY != null ? zeroY : scale.y(0);
        var limH = Math.min(o.values.length - 1, i1);
        for (var m = Math.max(0, i0); m <= limH; m++) {
          var vh = o.values[m];
          if (vh == null || !isFinite(vh)) continue;
          ctx.fillStyle = hexA(vh >= 0 ? ins.colors[o.upKey] : ins.colors[o.dnKey], 0.75);
          var xh = self.xAt(m) + self.barW / 2;
          var yv = scale.y(vh);
          ctx.fillRect(xh - bodyW / 2, Math.min(y0, yv), bodyW, Math.max(1, Math.abs(y0 - yv)));
        }
      } else if (o.kind === 'vhist') {
        var bot = scale.top + scale.h - scale.pb;
        var limV = Math.min(o.values.length - 1, i1);
        for (var q = Math.max(0, i0); q <= limV; q++) {
          var vv = o.values[q];
          if (vv == null || !isFinite(vv)) continue;
          var ck = self.active[q];
          var up = ck && ck.close >= ck.open;
          ctx.fillStyle = hexA(up ? ins.colors[o.upKey] : ins.colors[o.dnKey], 0.55);
          var xv = self.xAt(q) + self.barW / 2;
          var yvv = scale.y(vv);
          ctx.fillRect(xv - bodyW / 2, yvv, bodyW, Math.max(1, bot - yvv));
        }
      }
    });
  };

  Chart.prototype._renderOsc = function (pane, i0, i1, v0, v1, plotW, timeTicks) {
    var ctx = this.ctx, th = this.theme;
    var ins = pane.ins;
    if (!ins.result) return;
    var res = ins.result;

    var min = Infinity, max = -Infinity;
    if (res.fixedRange) { min = res.fixedRange.min; max = res.fixedRange.max; }
    else {
      res.outputs.forEach(function (o) {
        if (!o.values) return;
        var lim = Math.min(o.values.length - 1, i1);
        for (var i = Math.max(0, i0); i <= lim; i++) {
          var v = o.values[i];
          if (v == null || !isFinite(v)) continue;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        if (o.kind === 'hist') { if (min > 0) min = 0; if (max < 0) max = 0; }
        if (o.kind === 'vhist') { min = 0; }
      });
      if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
      if (max === min) { max += 1; min -= 1; }
    }
    var scale = new Scale(min, max, pane.top, pane.h, res.isVolume ? 16 : 10, res.isVolume ? 4 : 10);
    pane.scale = scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pane.top, plotW + this.scaleW, pane.h);
    ctx.clip();

    this._vGrid(ctx, timeTicks, pane.top, pane.h);

    var isVol = !!res.isVolume;
    this._priceGrid(ctx, scale, plotW, 2, isVol ? fmtVol : function (v) {
      var span = Math.abs(max - min);
      return fmtN(v, span > 500 ? 0 : span > 20 ? 1 : span > 1 ? 2 : 4);
    });

    (res.levels || []).forEach(function (lv) {
      var y = Math.round(scale.y(lv.v)) + 0.5;
      if (y < pane.top || y > pane.top + pane.h) return;
      ctx.strokeStyle = lv.faint ? th.grid : hexA(th.crossLine, 0.35);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    ctx.beginPath();
    ctx.rect(0, pane.top, plotW, pane.h);
    ctx.clip();
    this._renderFills(ctx, ins, scale, i0, i1);
    this._renderOutputs(ctx, ins, scale, i0, i1, null);
    ctx.restore();
  };

  Chart.prototype._renderTimeAxis = function (ticks, plotW, W, H) {
    var ctx = this.ctx, th = this.theme;
    var top = H - this.axisH;
    ctx.fillStyle = th.axisBg;
    ctx.fillRect(0, top, W, this.axisH);
    ctx.strokeStyle = th.border;
    ctx.beginPath();
    ctx.moveTo(0, top + 0.5);
    ctx.lineTo(W, top + 0.5);
    ctx.stroke();
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ticks.forEach(function (t) {
      ctx.fillStyle = t.strong ? th.textStrong : th.text;
      ctx.fillText(t.label, t.x, top + 15);
    });
  };

  Chart.prototype._axisLabel = function (ctx, plotW, y, text, bg, fg) {
    ctx.font = '10px -apple-system, sans-serif';
    var w = this.scaleW - 4;
    var yy = Math.round(y);
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(plotW + 2, yy - 9, w, 18, 3);
    else ctx.rect(plotW + 2, yy - 9, w, 18);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, plotW + 6, yy);
  };

  // ---------- crosshair ----------
  Chart.prototype._renderCrosshair = function () {
    var octx = this.octx, th = this.theme;
    var W = this.mount.clientWidth || 300;
    var H = this._canvasH;
    octx.clearRect(0, 0, W, H);

    // realce del separador arrastrable
    if (this._mouse && !this._pan && !this._drawState) {
      var sepIdx = this._resizePane ? this._resizePane.idx : this._separatorAt(this._mouse.y);
      if (sepIdx > 0 && this._paneRects[sepIdx]) {
        octx.strokeStyle = th.resizeHot;
        octx.lineWidth = 3;
        octx.beginPath();
        octx.moveTo(0, this._paneRects[sepIdx].top);
        octx.lineTo(W, this._paneRects[sepIdx].top);
        octx.stroke();
      }
    }

    var m = this._mouse;
    var n = this.active.length;
    if (!m || !n || m.x > this._plotW() || m.y > H - this.axisH) {
      if (this.opts.onCrosshair) this.opts.onCrosshair(null);
      this._renderDrawPreview(octx);
      return;
    }

    var plotW = this._plotW();
    var fi = this.indexAt(m.x - this.barW / 2);
    var idx = clamp(Math.round(fi), 0, n - 1);
    var snapX = this.xAt(idx) + this.barW / 2;

    octx.strokeStyle = th.crossLine;
    octx.lineWidth = 1;
    octx.setLineDash([4, 4]);
    octx.beginPath();
    octx.moveTo(Math.round(snapX) + 0.5, 0);
    octx.lineTo(Math.round(snapX) + 0.5, H - this.axisH);
    octx.stroke();

    var pane = this._paneAt(m.y);
    if (pane) {
      octx.beginPath();
      octx.moveTo(0, Math.round(m.y) + 0.5);
      octx.lineTo(plotW, Math.round(m.y) + 0.5);
      octx.stroke();
      octx.setLineDash([]);
      var scale = pane.kind === 'main' ? this._mainScale : pane.scale;
      if (scale) {
        var price = scale.invert(m.y);
        var isVol = pane.kind === 'ind' && pane.ins.result && pane.ins.result.isVolume;
        var txt = isVol ? fmtVol(price)
          : (pane.kind === 'main' && this.scaleMode === 'percent' && scale.base
            ? fmtN((price / scale.base - 1) * 100, 2) + '%'
            : fmtN(price, pane.kind === 'main' ? this.decimals : 2));
        this._axisLabelOverlay(octx, plotW, m.y, txt);
      }
    }
    octx.setLineDash([]);

    var t = this.active[idx] ? this.active[idx].time : null;
    if (t != null) {
      var d = this._d(t);
      var txt2 = d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + " '" + ('' + d.getUTCFullYear()).slice(2);
      if (this.intervalMs < 86400e3) txt2 += '  ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
      octx.font = '10px -apple-system, sans-serif';
      var tw = octx.measureText(txt2).width + 14;
      var tx = clamp(snapX - tw / 2, 0, W - tw);
      octx.fillStyle = th.crossLabelBg;
      octx.beginPath();
      if (octx.roundRect) octx.roundRect(tx, H - this.axisH + 3, tw, 18, 3);
      else octx.rect(tx, H - this.axisH + 3, tw, 18);
      octx.fill();
      octx.fillStyle = th.crossLabelFg;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(txt2, tx + tw / 2, H - this.axisH + 12);
    }

    this._renderDrawPreview(octx);
    if (this.opts.onCrosshair) this.opts.onCrosshair(idx);
  };

  Chart.prototype._axisLabelOverlay = function (octx, plotW, y, text) {
    var th = this.theme;
    octx.font = '10px -apple-system, sans-serif';
    octx.fillStyle = th.crossLabelBg;
    var yy = Math.round(y);
    octx.beginPath();
    if (octx.roundRect) octx.roundRect(plotW + 2, yy - 9, this.scaleW - 4, 18, 3);
    else octx.rect(plotW + 2, yy - 9, this.scaleW - 4, 18);
    octx.fill();
    octx.fillStyle = th.crossLabelFg;
    octx.textAlign = 'left';
    octx.textBaseline = 'middle';
    octx.fillText(text, plotW + 6, yy);
  };

  Chart.prototype._paneAt = function (y) {
    for (var i = 0; i < this._paneRects.length; i++) {
      var p = this._paneRects[i];
      if (y >= p.top && y < p.top + p.h) return p;
    }
    return null;
  };

  // ---------- dibujos ----------
  Chart.prototype.setTool = function (t) {
    this.tool = t;
    this._drawState = null;
    if (t !== 'cursor') this.selection = null;
    this.requestRender();
  };

  Chart.prototype.getDrawings = function () {
    return this.drawings.map(function (d) {
      return {
        type: d.type, p1: d.p1, p2: d.p2, p3: d.p3,
        color: d.color, width: d.width, dash: d.dash, text: d.text, locked: d.locked
      };
    });
  };
  Chart.prototype.setDrawings = function (list) {
    this.drawings = (list || []).map(function (d, i) {
      return {
        id: 'd' + i, type: d.type, p1: d.p1, p2: d.p2 || null, p3: d.p3 || null,
        color: d.color || '#2962ff', width: d.width || 2, dash: d.dash || null,
        text: d.text || '', locked: !!d.locked
      };
    });
    Chart._dseq = this.drawings.length + 1;
    this.selection = null;
    this.requestRender();
  };
  Chart._dseq = 1;

  Chart.prototype.clearDrawings = function () {
    this._pushUndo();
    this.drawings = [];
    this.selection = null;
    this.requestRender();
    if (this.opts.onDrawingsChange) this.opts.onDrawingsChange();
  };

  Chart.prototype.deleteSelected = function () {
    if (!this.selection) return;
    this.removeDrawing(this.selection.id);
  };

  Chart.prototype.removeDrawing = function (id) {
    this._pushUndo();
    this.drawings = this.drawings.filter(function (d) { return d.id !== id; });
    if (this.selection && this.selection.id === id) this.selection = null;
    this.requestRender();
    if (this.opts.onDrawingsChange) this.opts.onDrawingsChange();
  };

  Chart.prototype.cloneDrawing = function (id) {
    var src = this.drawings.find(function (d) { return d.id === id; });
    if (!src) return;
    this._pushUndo();
    var off = this.intervalMs * 6;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = 'd' + (Chart._dseq++);
    ['p1', 'p2', 'p3'].forEach(function (k) { if (copy[k]) copy[k].t += off; });
    this.drawings.push(copy);
    this.selection = copy;
    this.requestRender();
    if (this.opts.onDrawingsChange) this.opts.onDrawingsChange();
  };

  Chart.prototype.updateDrawing = function (id, props) {
    var dr = this.drawings.find(function (d) { return d.id === id; });
    if (!dr) return;
    this._pushUndo();
    Object.keys(props).forEach(function (k) { dr[k] = props[k]; });
    this.requestRender();
    if (this.opts.onDrawingsChange) this.opts.onDrawingsChange();
  };

  var DRAW_NAMES = {
    trend: 'Línea de tendencia', ray: 'Rayo', extline: 'Línea extendida',
    hline: 'Línea horizontal', hray: 'Rayo horizontal', vline: 'Línea vertical',
    rect: 'Rectángulo', ellipse: 'Elipse', arrow: 'Flecha', text: 'Texto',
    fib: 'Fibonacci', ruler: 'Regla', position: 'Posición', channel: 'Canal paralelo'
  };
  Chart.prototype.drawingLabel = function (dr) { return DRAW_NAMES[dr.type] || dr.type; };

  // ---------- deshacer / rehacer ----------
  Chart.prototype._snapshot = function () { return JSON.stringify(this.getDrawings()); };

  Chart.prototype._pushUndo = function () {
    this._undo.push(this._snapshot());
    if (this._undo.length > 60) this._undo.shift();
    this._redo.length = 0;
  };

  Chart.prototype._restore = function (json) {
    var sel = this.selection && this.selection.id;
    this.setDrawings(JSON.parse(json));
    this.selection = this.drawings.find(function (d) { return d.id === sel; }) || null;
    this.requestRender();
    if (this.opts.onDrawingsChange) this.opts.onDrawingsChange();
  };

  Chart.prototype.undo = function () {
    if (!this._undo.length) return false;
    var cur = this._snapshot();
    this._restore(this._undo.pop());
    this._redo.push(cur);
    return true;
  };

  Chart.prototype.redo = function () {
    if (!this._redo.length) return false;
    var cur = this._snapshot();
    this._restore(this._redo.pop());
    this._undo.push(cur);
    return true;
  };

  Chart.prototype.zoomToRange = function (ms) {
    var n = this.active.length;
    if (!n) return;
    var plotW = this._plotW();
    if (ms == null) {
      this.barW = clamp(plotW / n, 0.4, 60);
    } else {
      var fromIdx = this.indexForTime(this.active[n - 1].time - ms);
      var bars = Math.max(5, (n - 1) - fromIdx);
      this.barW = clamp(plotW / (bars * 1.06), 0.4, 60);
    }
    this.rightIndex = n - 1 + Math.max(2, Math.round(plotW / this.barW * 0.04));
    this.requestRender();
  };

  Chart.prototype.resetView = function () {
    var n = this.active.length;
    if (!n) return;
    var plotW = this._plotW();
    this.barW = clamp(plotW / Math.max(60, Math.min(180, n)), 2, 20);
    this.rightIndex = n - 1 + Math.max(4, Math.round(plotW / this.barW * 0.06));
    this.requestRender();
  };

  Chart.prototype._drawToScreen = function (pt, scale) {
    return { x: this.xAt(this.indexForTime(pt.t)) + this.barW / 2, y: scale.y(pt.price) };
  };

  Chart.prototype._screenToData = function (x, y, scale) {
    var fi = this.indexAt(x - this.barW / 2);
    var price = scale.invert(y);
    if (this.magnet && this.magnet !== 'off') {
      var i = clamp(Math.round(fi), 0, this.display.length - 1);
      var k = this.display[i];
      if (k) {
        var best = null, bestD = Infinity;
        [k.open, k.high, k.low, k.close].forEach(function (v) {
          var dd = Math.abs(scale.y(v) - y);
          if (dd < bestD) { bestD = dd; best = v; }
        });
        // Imán débil: sólo cuando el puntero está cerca. Fuerte: siempre.
        var limit = this.magnet === 'strong' ? Infinity : 22;
        if (best != null && bestD < limit) return { t: this.timeForIndex(i), price: best };
      }
    }
    return { t: this.timeForIndex(fi), price: price };
  };

  Chart.prototype._renderDrawings = function (ctx, scale, plotW, pane) {
    var self = this;
    this.drawings.forEach(function (dr) {
      var sel = self.selection && self.selection.id === dr.id;
      self._renderDrawing(ctx, dr, scale, plotW, pane, sel);
    });
  };

  Chart.prototype._renderDrawing = function (ctx, dr, scale, plotW, pane, sel) {
    ctx.lineWidth = dr.width || 2;
    ctx.strokeStyle = dr.color;
    ctx.setLineDash(dr.dash || []);
    var a = dr.p1 ? this._drawToScreen(dr.p1, scale) : null;
    var b = dr.p2 ? this._drawToScreen(dr.p2, scale) : null;
    var c = dr.p3 ? this._drawToScreen(dr.p3, scale) : null;
    var dec = this.decimals;
    if (!a) { ctx.setLineDash([]); return; }

    function line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    function extend(from, to, both) {
      var dx = to.x - from.x, dy = to.y - from.y;
      if (Math.abs(dx) < 0.01) return { a: { x: from.x, y: pane.top }, b: { x: from.x, y: pane.top + pane.h } };
      var kR = (plotW + 60 - from.x) / dx, kL = (-60 - from.x) / dx;
      var pR = { x: from.x + dx * kR, y: from.y + dy * kR };
      var pL = both ? { x: from.x + dx * kL, y: from.y + dy * kL } : from;
      return { a: pL, b: pR };
    }

    switch (dr.type) {
      case 'hline':
      case 'hray': {
        var y = Math.round(scale.y(dr.p1.price)) + 0.5;
        var x0 = dr.type === 'hray' ? a.x : 0;
        line(x0, y, plotW, y);
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillStyle = dr.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtN(dr.p1.price, dec), x0 + 5, y - 3);
        break;
      }
      case 'vline':
        line(Math.round(a.x) + 0.5, pane.top, Math.round(a.x) + 0.5, pane.top + pane.h);
        break;
      case 'trend':
        if (b) line(a.x, a.y, b.x, b.y);
        break;
      case 'ray':
        if (b) { var r = extend(a, b, false); line(a.x, a.y, r.b.x, r.b.y); }
        break;
      case 'extline':
        if (b) { var e = extend(a, b, true); line(e.a.x, e.a.y, e.b.x, e.b.y); }
        break;
      case 'arrow':
        if (b) {
          line(a.x, a.y, b.x, b.y);
          var ang = Math.atan2(b.y - a.y, b.x - a.x);
          var hl = 11 + (dr.width || 2) * 2;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - hl * Math.cos(ang - 0.4), b.y - hl * Math.sin(ang - 0.4));
          ctx.lineTo(b.x - hl * Math.cos(ang + 0.4), b.y - hl * Math.sin(ang + 0.4));
          ctx.closePath();
          ctx.fillStyle = dr.color;
          ctx.fill();
        }
        break;
      case 'rect':
        if (b) {
          var rx = Math.min(a.x, b.x), ry = Math.min(a.y, b.y);
          var rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
          ctx.fillStyle = hexA(dr.color, 0.12);
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
        }
        break;
      case 'ellipse':
        if (b) {
          ctx.beginPath();
          ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2,
            Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
          ctx.fillStyle = hexA(dr.color, 0.12);
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'text':
        ctx.font = '600 ' + (11 + (dr.width || 2) * 2) + 'px -apple-system, sans-serif';
        ctx.fillStyle = dr.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(dr.text || 'Texto', a.x + 4, a.y);
        break;
      case 'channel':
        if (b) {
          line(a.x, a.y, b.x, b.y);
          if (c) {
            var off = c.y - (a.y + (b.y - a.y) * ((c.x - a.x) / ((b.x - a.x) || 1)));
            line(a.x, a.y + off, b.x, b.y + off);
            ctx.fillStyle = hexA(dr.color, 0.1);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(b.x, b.y + off);
            ctx.lineTo(a.x, a.y + off);
            ctx.closePath();
            ctx.fill();
          }
        }
        break;
      case 'fib':
        if (b) {
          var xL = Math.min(a.x, b.x), xR = Math.max(a.x, b.x);
          var p1v = dr.p1.price, p2v = dr.p2.price;
          ctx.font = '10px -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          for (var f = 0; f < FIB_LEVELS.length; f++) {
            var lv = FIB_LEVELS[f];
            var pr = p2v + (p1v - p2v) * lv;
            var yF = Math.round(scale.y(pr)) + 0.5;
            ctx.strokeStyle = FIB_COLORS[f];
            line(xL, yF, xR, yF);
            ctx.fillStyle = FIB_COLORS[f];
            ctx.fillText(lv.toFixed(3) + '  (' + fmtN(pr, dec) + ')', xL + 4, yF - 2);
            if (f > 0) {
              var prPrev = p2v + (p1v - p2v) * FIB_LEVELS[f - 1];
              ctx.fillStyle = hexA(FIB_COLORS[f], 0.07);
              ctx.fillRect(xL, Math.min(yF, scale.y(prPrev)), xR - xL, Math.abs(yF - scale.y(prPrev)));
            }
          }
          ctx.strokeStyle = dr.color;
        }
        break;
      case 'ruler':
        if (b) {
          var upR = dr.p2.price >= dr.p1.price;
          var col = upR ? this.upColor() : this.downColor();
          ctx.strokeStyle = col;
          ctx.fillStyle = hexA(col, 0.12);
          ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
          line(a.x, a.y, b.x, b.y);
          var dPrice = dr.p2.price - dr.p1.price;
          var dPct = dr.p1.price ? dPrice / dr.p1.price * 100 : 0;
          var bars = Math.round((dr.p2.t - dr.p1.t) / this.intervalMs);
          var txt = (dPrice >= 0 ? '+' : '') + fmtN(dPrice, dec) +
            '  (' + (dPct >= 0 ? '+' : '') + fmtN(dPct, 2) + '%)  ' + Math.abs(bars) + ' velas';
          ctx.font = '11px -apple-system, sans-serif';
          var tw = ctx.measureText(txt).width + 12;
          var bx = (a.x + b.x) / 2 - tw / 2, by = Math.min(a.y, b.y) - 24;
          ctx.fillStyle = col;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(bx, by, tw, 20, 4); else ctx.rect(bx, by, tw, 20);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, bx + tw / 2, by + 10);
        }
        break;
      case 'position':
        if (b) {
          // Entrada en p1, objetivo en p2; el riesgo se dibuja a la mitad.
          var entry = dr.p1.price, target = dr.p2.price;
          var risk = entry - (target - entry) / 2;
          var xa = Math.min(a.x, b.x), xb = Math.max(a.x, b.x) + 40;
          var yE = scale.y(entry), yT = scale.y(target), yR = scale.y(risk);
          ctx.fillStyle = hexA(this.upColor(), 0.16);
          ctx.fillRect(xa, Math.min(yE, yT), xb - xa, Math.abs(yT - yE));
          ctx.fillStyle = hexA(this.downColor(), 0.16);
          ctx.fillRect(xa, Math.min(yE, yR), xb - xa, Math.abs(yR - yE));
          ctx.strokeStyle = dr.color;
          line(xa, yE, xb, yE);
          ctx.font = '10px -apple-system, sans-serif';
          ctx.fillStyle = this.theme.textStrong;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText('Objetivo ' + fmtN(target, dec), xa + 4, Math.min(yE, yT) + 12);
          ctx.fillText('Entrada ' + fmtN(entry, dec), xa + 4, yE - 3);
        }
        break;
    }
    ctx.setLineDash([]);

    if (sel) {
      var th2 = this.theme;
      [a, b, c].forEach(function (pt) {
        if (!pt) return;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = th2.selection;
        ctx.stroke();
      });
    }
  };

  Chart.prototype._renderDrawPreview = function (octx) {
    var st = this._drawState;
    if (!st || !st.p1 || !this._mouse || !this._mainScale) return;
    var pane = this._paneRects[0];
    var m = this._mouse;
    var live = this._screenToData(m.x, clamp(m.y, pane.top, pane.top + pane.h), this._mainScale);
    var tmp = {
      id: '_tmp', type: st.tool,
      p1: st.p1, p2: st.p2 || live, p3: st.p2 ? live : null,
      color: this.drawStyle.color, width: this.drawStyle.width, dash: this.drawStyle.dash,
      text: 'Texto'
    };
    octx.save();
    octx.beginPath();
    octx.rect(0, pane.top, this._plotW(), pane.h);
    octx.clip();
    this._renderDrawing(octx, tmp, this._mainScale, this._plotW(), pane, false);
    octx.restore();
  };

  Chart.prototype._hitTestDrawing = function (x, y) {
    if (!this._mainScale || this.drawingsHidden) return null;
    var scale = this._mainScale;
    var pane = this._paneRects[0];
    if (y > pane.top + pane.h) return null;
    var TOL = 7;
    function distSeg(px, py, x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1;
      var len2 = dx * dx + dy * dy;
      var t = len2 ? clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1) : 0;
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    for (var i = this.drawings.length - 1; i >= 0; i--) {
      var dr = this.drawings[i];
      if (dr.locked) continue;
      var a = dr.p1 ? this._drawToScreen(dr.p1, scale) : null;
      var b = dr.p2 ? this._drawToScreen(dr.p2, scale) : null;
      var c = dr.p3 ? this._drawToScreen(dr.p3, scale) : null;
      if (!a) continue;
      if (Math.hypot(x - a.x, y - a.y) < TOL) return { dr: dr, handle: 'p1' };
      if (b && Math.hypot(x - b.x, y - b.y) < TOL) return { dr: dr, handle: 'p2' };
      if (c && Math.hypot(x - c.x, y - c.y) < TOL) return { dr: dr, handle: 'p3' };

      var hit = false;
      switch (dr.type) {
        case 'hline': hit = Math.abs(y - scale.y(dr.p1.price)) < TOL; break;
        case 'hray': hit = Math.abs(y - scale.y(dr.p1.price)) < TOL && x >= a.x - TOL; break;
        case 'vline': hit = Math.abs(x - a.x) < TOL; break;
        case 'text': hit = x >= a.x - TOL && x < a.x + 130 && Math.abs(y - a.y) < 12; break;
        case 'trend': case 'arrow': case 'ruler':
          hit = !!b && distSeg(x, y, a.x, a.y, b.x, b.y) < TOL; break;
        case 'ray': case 'extline': {
          if (!b) break;
          var dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) < 0.01) { hit = Math.abs(x - a.x) < TOL; break; }
          var kk = (x - a.x) / dx;
          if (dr.type === 'ray' && kk < 0) break;
          hit = Math.abs(y - (a.y + dy * kk)) < TOL;
          break;
        }
        case 'channel': {
          if (!b) break;
          hit = distSeg(x, y, a.x, a.y, b.x, b.y) < TOL;
          if (!hit && c) {
            var off = c.y - (a.y + (b.y - a.y) * ((c.x - a.x) / ((b.x - a.x) || 1)));
            hit = distSeg(x, y, a.x, a.y + off, b.x, b.y + off) < TOL;
          }
          break;
        }
        case 'rect': case 'ellipse': case 'position': {
          if (!b) break;
          var x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
          var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
          hit = x >= x0 - TOL && x <= x1 + TOL && y >= y0 - TOL && y <= y1 + TOL;
          break;
        }
        case 'fib': {
          if (!b) break;
          var xL = Math.min(a.x, b.x), xR = Math.max(a.x, b.x);
          for (var f = 0; f < FIB_LEVELS.length; f++) {
            var pr = dr.p2.price + (dr.p1.price - dr.p2.price) * FIB_LEVELS[f];
            if (x >= xL - TOL && x <= xR + TOL && Math.abs(y - scale.y(pr)) < TOL) { hit = true; break; }
          }
          break;
        }
      }
      if (hit) return { dr: dr, handle: 'body' };
    }
    return null;
  };

  // ---------- eventos ----------
  Chart.prototype._bindEvents = function () {
    var self = this;
    var el = this.overlay;
    el.style.cursor = 'crosshair';

    function pos(ev) {
      var r = el.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    function finishDrawing(p) {
      var need = TOOL_POINTS[self.tool] || 2;
      var st = self._drawState;
      var dr = {
        id: 'd' + (Chart._dseq++), type: self.tool,
        p1: st.p1, p2: need === 1 ? null : (st.p2 || p), p3: need === 3 ? p : null,
        color: self.drawStyle.color, width: self.drawStyle.width, dash: self.drawStyle.dash,
        text: self.tool === 'text' ? 'Texto' : '', locked: false
      };
      self._pushUndo();
      self.drawings.push(dr);
      self._drawState = null;
      if (!self.keepDrawing) {
        self.setTool('cursor');
        if (self.opts.onToolDone) self.opts.onToolDone();
      }
      if (self.opts.onDrawingsChange) self.opts.onDrawingsChange();
      if (self.opts.onDrawingCreated) self.opts.onDrawingCreated(dr);
      self.requestRender();
    }

    el.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      var p = pos(ev);
      var hit = self._hitTestDrawing(p.x, p.y);
      if (self.opts.onContextMenu) {
        self.opts.onContextMenu({
          x: ev.clientX, y: ev.clientY,
          drawing: hit ? hit.dr : null,
          price: self._mainScale && p.y <= self._paneRects[0].h ? self._mainScale.invert(p.y) : null,
          pane: self._paneAt(p.y)
        });
      }
    });

    el.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      var p = pos(ev);

      var sep = self._separatorAt(p.y);
      if (sep > 0 && self.tool === 'cursor') {
        self._resizePane = {
          idx: sep, startY: p.y,
          prevH: self._paneRects[sep - 1].h,
          curH: self._paneRects[sep].h,
          prevId: self._paneRects[sep - 1].id,
          curId: self._paneRects[sep].id
        };
        return;
      }

      var m = self._mainScale;
      if (self.tool !== 'cursor' && m) {
        var pane0 = self._paneRects[0];
        if (p.y <= pane0.top + pane0.h && p.x <= self._plotW()) {
          var dp = self._screenToData(p.x, p.y, m);
          var need = TOOL_POINTS[self.tool] || 2;
          if (!self._drawState) {
            self._drawState = { tool: self.tool, p1: dp };
            if (need === 1) finishDrawing(dp);
          } else if (need === 3 && !self._drawState.p2) {
            self._drawState.p2 = dp;
          } else {
            finishDrawing(dp);
          }
          return;
        }
      }

      var hitD = self.drawingsLocked ? null : self._hitTestDrawing(p.x, p.y);
      if (hitD) {
        self.selection = hitD.dr;
        self._pan = null;
        self._pushUndo();
        self._dragDraw = {
          dr: hitD.dr, handle: hitD.handle,
          startX: p.x, startY: p.y,
          p1: hitD.dr.p1 ? { t: hitD.dr.p1.t, price: hitD.dr.p1.price } : null,
          p2: hitD.dr.p2 ? { t: hitD.dr.p2.t, price: hitD.dr.p2.price } : null,
          p3: hitD.dr.p3 ? { t: hitD.dr.p3.t, price: hitD.dr.p3.price } : null
        };
        if (self.opts.onSelection) self.opts.onSelection(hitD.dr);
        self.requestRender();
        return;
      }
      if (self.selection) {
        self.selection = null;
        if (self.opts.onSelection) self.opts.onSelection(null);
        self.requestRender();
      }

      self._pan = { startX: p.x, startRI: self.rightIndex };
      el.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', function (ev) {
      var p = pos(ev);
      self._mouse = p;

      if (self._resizePane) {
        var r = self._resizePane;
        var dy = p.y - r.startY;
        self.paneSizes[r.prevId] = clamp(r.prevH + dy, 60, 2400);
        self.paneSizes[r.curId] = clamp(r.curH - dy, 60, 2400);
        self.resize();
        return;
      }

      if (self._dragDraw && self._mainScale) {
        var dd = self._dragDraw;
        var dT = self.timeForIndex(self.indexAt(p.x)) - self.timeForIndex(self.indexAt(dd.startX));
        var dP = self._mainScale.invert(p.y) - self._mainScale.invert(dd.startY);
        var keys = dd.handle === 'body' ? ['p1', 'p2', 'p3'] : [dd.handle];
        keys.forEach(function (k) {
          if (!dd[k]) return;
          dd.dr[k] = { t: dd[k].t + dT, price: dd[k].price + dP };
        });
        self.requestRender();
        return;
      }

      if (self._pan) {
        self.rightIndex = self._pan.startRI - (p.x - self._pan.startX) / self.barW;
        self.requestRender();
        return;
      }

      el.style.cursor = (self.tool === 'cursor' && self._separatorAt(p.y) > 0) ? 'row-resize' : 'crosshair';
      self._dirty = true;
    });

    window.addEventListener('mouseup', function () {
      if (self._resizePane) {
        self._resizePane = null;
        if (self.opts.onPanesResized) self.opts.onPanesResized(self.paneSizes);
      }
      if (self._dragDraw) {
        self._dragDraw = null;
        if (self.opts.onDrawingsChange) self.opts.onDrawingsChange();
      }
      self._pan = null;
      el.style.cursor = 'crosshair';
    });

    el.addEventListener('mouseleave', function () {
      self._mouse = null;
      self._dirty = true;
    });

    el.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var p = pos(ev);
      var factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      var fi = self.indexAt(p.x);
      var newW = clamp(self.barW * factor, 0.4, 60);
      self.rightIndex = fi + (self._plotW() - p.x) / newW;
      self.barW = newW;
      self.requestRender();
    }, { passive: false });

    el.addEventListener('dblclick', function () { self.resetView(); });

    el.addEventListener('touchstart', function (ev) {
      if (ev.touches.length === 1) {
        var r = el.getBoundingClientRect();
        self._pan = { startX: ev.touches[0].clientX - r.left, startRI: self.rightIndex };
      } else if (ev.touches.length === 2) {
        self._pan = null;
        self._pinch = {
          d: Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY),
          barW: self.barW
        };
      }
    }, { passive: true });
    el.addEventListener('touchmove', function (ev) {
      var r = el.getBoundingClientRect();
      if (ev.touches.length === 1 && self._pan) {
        var x = ev.touches[0].clientX - r.left;
        self.rightIndex = self._pan.startRI - (x - self._pan.startX) / self.barW;
        self.requestRender();
      } else if (ev.touches.length === 2 && self._pinch) {
        var d = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
        self.barW = clamp(self._pinch.barW * d / self._pinch.d, 0.4, 60);
        self.requestRender();
      }
      ev.preventDefault();
    }, { passive: false });
    el.addEventListener('touchend', function () { self._pan = null; self._pinch = null; });

    window.addEventListener('keydown', function (ev) {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA')) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        if (self.selection) { self.deleteSelected(); ev.preventDefault(); }
      } else if (ev.key === 'Escape') {
        self._drawState = null;
        self.setTool('cursor');
        if (self.opts.onToolDone) self.opts.onToolDone();
      } else if (ev.key === 'ArrowLeft') { self.rightIndex -= 10; self.requestRender(); }
      else if (ev.key === 'ArrowRight') { self.rightIndex += 10; self.requestRender(); }
      else if (ev.key === '+' || ev.key === '=') { self.barW = clamp(self.barW * 1.15, 0.4, 60); self.requestRender(); }
      else if (ev.key === '-') { self.barW = clamp(self.barW / 1.15, 0.4, 60); self.requestRender(); }
    });
  };

  Chart.prototype.historyLoaded = function () { this._loadingHistory = false; };

  Chart.prototype.snapshot = function (title) {
    var dpr = window.devicePixelRatio || 1;
    var tmp = document.createElement('canvas');
    tmp.width = this.canvas.width;
    tmp.height = this.canvas.height + 40 * dpr;
    var t = tmp.getContext('2d');
    t.fillStyle = this.theme.bg;
    t.fillRect(0, 0, tmp.width, tmp.height);
    t.font = '700 ' + 16 * dpr + 'px -apple-system, sans-serif';
    t.fillStyle = this.theme.textStrong;
    t.fillText(title || (this.symbol + ' · ' + this.interval), 12 * dpr, 26 * dpr);
    t.drawImage(this.canvas, 0, 40 * dpr);
    return tmp;
  };

  TV.Chart = Chart;
  TV.fmtN = fmtN;
  TV.fmtVol = fmtVol;
  TV.decimalsFor = decimalsFor;
  TV.TOOL_POINTS = TOOL_POINTS;
  TV.DRAW_NAMES = DRAW_NAMES;
})();
