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
      areaLine: '#2962ff', sepLine: '#2a2e39'
    },
    light: {
      bg: '#ffffff', grid: '#f0f3fa', gridStrong: '#e4e8f0', text: '#787b86', textStrong: '#131722',
      up: '#26a69a', down: '#ef5350', border: '#e0e3eb', axisBg: '#ffffff',
      crossLine: '#9598a1', crossLabelBg: '#4c525e', crossLabelFg: '#ffffff',
      watermark: 'rgba(80,83,94,0.08)', selection: '#2962ff',
      areaLine: '#2962ff', sepLine: '#e0e3eb'
    }
  };

  var PALETTE = ['#2962ff', '#ff6d00', '#26c6da', '#ab47bc', '#66bb6a', '#ffca28', '#ef5350',
    '#5c6bc0', '#ec407a', '#00e676', '#e040fb', '#29b6f6', '#ff7043', '#9ccc65', '#7e57c2'];

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  var FIB_COLORS = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86'];

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

  function fmtN(v, dec) {
    if (v == null || !isFinite(v)) return '—';
    var s = v.toFixed(dec);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  }

  function fmtVol(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + ' B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + ' M';
    if (a >= 1e3) return (v / 1e3).toFixed(2) + ' K';
    return v.toFixed(2);
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
  function Scale(min, max, top, h, padTop, padBot) {
    this.min = min; this.max = max;
    this.top = top; this.h = h;
    this.pt = padTop == null ? 8 : padTop;
    this.pb = padBot == null ? 8 : padBot;
  }
  Scale.prototype.y = function (v) {
    var inner = this.h - this.pt - this.pb;
    if (this.max === this.min) return this.top + this.pt + inner / 2;
    return this.top + this.pt + (this.max - v) / (this.max - this.min) * inner;
  };
  Scale.prototype.invert = function (py) {
    var inner = this.h - this.pt - this.pb;
    if (inner <= 0) return this.min;
    return this.max - (py - this.top - this.pt) / inner * (this.max - this.min);
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

    // estado de datos
    this.candles = [];
    this.display = [];        // velas mostradas (Heikin Ashi transforma)
    this.symbol = '';
    this.interval = '1h';
    this.intervalMs = 3600e3;
    this.type = 'candles';
    this.decimals = 2;
    this.dataVersion = 0;

    // estado de vista
    this.barW = 8;
    this.rightIndex = 0;
    this.scaleW = 78;
    this.axisH = 30;

    // indicadores
    this.indicators = [];
    this._colorIdx = 0;

    // dibujos
    this.drawings = [];
    this.tool = 'cursor';
    this.selection = null;
    this._drawState = null;

    // interacción
    this._mouse = null;
    this._pan = null;
    this._pinch = null;
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
  }

  Chart.prototype.requestRender = function () { this._dirty = true; };

  Chart.prototype.setTheme = function (name) {
    this.theme = THEMES[name] || THEMES.dark;
    this.requestRender();
  };

  Chart.prototype.nextColor = function () {
    return PALETTE[this._colorIdx++ % PALETTE.length];
  };

  // ---------- datos ----------
  Chart.prototype.setData = function (candles, symbol, interval, intervalMs) {
    this.candles = candles || [];
    this.symbol = symbol || this.symbol;
    this.interval = interval || this.interval;
    this.intervalMs = intervalMs || this.intervalMs;
    this.dataVersion++;
    this._hasMoreHistory = true;
    this._loadingHistory = false;
    var last = this.candles[this.candles.length - 1];
    this.decimals = last ? decimalsFor(last.close) : 2;
    this._rebuildDisplay();
    var plotW = this._plotW();
    this.barW = clamp(plotW / Math.max(60, Math.min(180, this.candles.length)), 2, 20);
    this.rightIndex = this.candles.length - 1 + Math.max(4, Math.round(plotW / this.barW * 0.06));
    this.requestRender();
  };

  Chart.prototype.prepend = function (older) {
    if (!older || !older.length) { this._hasMoreHistory = false; return; }
    var firstT = this.candles.length ? this.candles[0].time : Infinity;
    var add = older.filter(function (k) { return k.time < firstT; });
    if (!add.length) { this._hasMoreHistory = false; return; }
    this.candles = add.concat(this.candles);
    this.rightIndex += add.length;
    this.dataVersion++;
    this._rebuildDisplay();
    this.requestRender();
  };

  Chart.prototype.mergeLive = function (k) {
    var n = this.candles.length;
    if (!n) return;
    var last = this.candles[n - 1];
    if (k.time === last.time) {
      this.candles[n - 1] = k;
    } else if (k.time > last.time) {
      var pinned = this.rightIndex >= n - 1;
      this.candles.push(k);
      if (pinned) this.rightIndex += 1;
    } else {
      return; // vela antigua, ignorar
    }
    this.dataVersion++;
    this._rebuildDisplay();
    this.requestRender();
  };

  Chart.prototype._rebuildDisplay = function () {
    var c = this.candles;
    if (this.type !== 'heikin') { this.display = c; return; }
    var out = new Array(c.length), po = null, pc = null;
    for (var i = 0; i < c.length; i++) {
      var k = c[i];
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

  // Rehace la disposición de paneles y avisa a la interfaz: cualquier cambio en
  // la lista de indicadores pasa por aquí, así la leyenda nunca se desincroniza.
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
    this._indChanged();
  };

  Chart.prototype.clearIndicators = function () {
    this.indicators = [];
    this._indChanged();
  };

  Chart.prototype._ensureComputed = function () {
    var self = this;
    this.indicators.forEach(function (ins) {
      if (ins._v !== self.dataVersion) {
        ins.result = TV.Indicators.compute(ins.key, self.candles, ins.params, { intervalMs: self.intervalMs });
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

  Chart.prototype.xAt = function (i) {
    return this._plotW() - (this.rightIndex - i) * this.barW;
  };
  Chart.prototype.indexAt = function (x) {
    return this.rightIndex - (this._plotW() - x) / this.barW;
  };

  Chart.prototype.timeForIndex = function (fi) {
    var c = this.candles, n = c.length;
    if (!n) return 0;
    var i = Math.floor(fi), fr = fi - i;
    if (i < 0) return c[0].time + fi * this.intervalMs;
    if (i >= n - 1) return c[n - 1].time + (fi - (n - 1)) * this.intervalMs;
    return c[i].time + fr * (c[i + 1].time - c[i].time);
  };

  Chart.prototype.indexForTime = function (t) {
    var c = this.candles, n = c.length;
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
    var nOsc = oscs.length;
    var oscH = clamp(Math.round(availH * 0.16), 90, 150);
    // El panel de precios nunca baja de este alto: si los osciladores no caben,
    // el lienzo crece y el contenedor pasa a hacer scroll (paneles ilimitados).
    var minMainH = Math.min(300, Math.max(160, availH - this.axisH - oscH));
    var mainH = Math.max(minMainH, availH - this.axisH - nOsc * oscH);
    this._canvasH = mainH + nOsc * oscH + this.axisH;
    var rects = [{ kind: 'main', top: 0, h: mainH }];
    var y = mainH;
    oscs.forEach(function (ins) {
      rects.push({ kind: 'ind', ins: ins, top: y, h: oscH });
      y += oscH;
    });
    this._paneRects = rects;

    var sig = rects.map(function (r) { return (r.ins ? r.ins.id : 'main') + ':' + r.top + ':' + r.h; }).join('|');
    if (sig !== this._layoutSig) {
      this._layoutSig = sig;
      if (this.opts.onLayout) this.opts.onLayout(rects);
    }
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

    var n = this.candles.length;
    if (!n) { this._renderCrosshair(); return; }

    this._ensureComputed();

    var plotW = this._plotW();
    this.rightIndex = clamp(this.rightIndex, 4, n - 1 + plotW / this.barW * 0.85);

    var i1 = Math.min(n + 400, Math.ceil(this.rightIndex) + 1);
    var i0 = Math.floor(this.rightIndex - plotW / this.barW) - 1;
    var v0 = Math.max(0, i0), v1 = Math.min(n - 1, i1);

    if (v0 < 60 && this._hasMoreHistory && !this._loadingHistory && this.opts.onNeedHistory) {
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

    // borde del eje de precios
    ctx.strokeStyle = th.border;
    ctx.beginPath();
    ctx.moveTo(plotW + 0.5, 0);
    ctx.lineTo(plotW + 0.5, H - this.axisH);
    ctx.stroke();

    this._renderCrosshair();
    if (this.opts.onRendered) this.opts.onRendered();
  };

  // marcas temporales "bonitas"
  Chart.prototype._timeTicks = function (i0, i1, plotW) {
    var out = [];
    var n = this.candles.length;
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
      var t = this.candles[i].time;
      var d = new Date(t);
      var hit = false, strong = false, label = '';
      if (unit === 'M1' || unit === 'M3' || unit === 'Y1') {
        var isFirstOfMonth = d.getUTCDate() === 1 && (i === 0 || new Date(this.candles[i - 1].time).getUTCMonth() !== d.getUTCMonth());
        var newMonth = i === 0 || new Date(this.candles[i - 1].time).getUTCMonth() !== d.getUTCMonth();
        if (unit === 'Y1') { hit = newMonth && d.getUTCMonth() === 0; strong = true; label = '' + d.getUTCFullYear(); }
        else if (unit === 'M3') { hit = newMonth && d.getUTCMonth() % 3 === 0; label = d.getUTCMonth() === 0 ? '' + d.getUTCFullYear() : MESES[d.getUTCMonth()]; strong = d.getUTCMonth() === 0; }
        else { hit = newMonth || isFirstOfMonth; label = d.getUTCMonth() === 0 ? '' + d.getUTCFullYear() : MESES[d.getUTCMonth()]; strong = d.getUTCMonth() === 0; }
      } else if (unit >= 86400e3) {
        var days = Math.round(unit / 86400e3);
        var dayN = Math.floor(t / 86400e3);
        hit = t % 86400e3 === 0 ? dayN % days === 0 : (i === 0 || Math.floor(this.candles[i - 1].time / 86400e3) !== dayN) && dayN % days === 0;
        if (hit) {
          if (d.getUTCDate() === 1) { label = d.getUTCMonth() === 0 ? '' + d.getUTCFullYear() : MESES[d.getUTCMonth()]; strong = true; }
          else label = '' + d.getUTCDate();
        }
      } else {
        hit = t % unit === 0;
        if (hit) {
          if (t % 86400e3 === 0) { label = d.getUTCDate() + ' ' + MESES[d.getUTCMonth()]; strong = true; }
          else {
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
    if (inner <= 0 || scale.max <= scale.min) return;
    var step = niceStep((scale.max - scale.min) / Math.max(2, inner / 55));
    var start = Math.ceil(scale.min / step) * step;
    ctx.font = '10px -apple-system, sans-serif';
    for (var v = start; v <= scale.max + step * 0.001; v += step) {
      var y = Math.round(scale.y(v)) + 0.5;
      if (y < scale.top + 2 || y > scale.top + scale.h - 2) continue;
      ctx.strokeStyle = th.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.fillStyle = th.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt ? fmt(v) : fmtN(v, dec), plotW + 6, y);
    }
  };

  Chart.prototype._vGrid = function (ctx, ticks, top, h) {
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
    var d = this.display, n = d.length;
    var self = this;

    // rango de precios visible
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

    var scale = new Scale(min, max, pane.top, pane.h, 14, 14);
    this._mainScale = scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pane.top, plotW + this.scaleW, pane.h);
    ctx.clip();

    // marca de agua
    ctx.font = '700 ' + Math.min(60, pane.h / 5) + 'px -apple-system, sans-serif';
    ctx.fillStyle = th.watermark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.symbol + ' · ' + this.interval.toUpperCase(), plotW / 2, pane.top + pane.h / 2);

    this._vGrid(ctx, timeTicks, pane.top, pane.h);
    this._priceGrid(ctx, scale, plotW, this.decimals);

    // recorta el dibujo de series al área del plot
    ctx.beginPath();
    ctx.rect(0, pane.top, plotW, pane.h);
    ctx.clip();

    // rellenos de indicadores por debajo de las velas
    this.indicators.forEach(function (ins) {
      if (ins.def.cat !== 'overlay' || !ins.visible || !ins.result) return;
      self._renderFills(ctx, ins, scale, i0, i1);
    });

    // precio
    var bodyW = Math.max(1, this.barW * 0.72);
    if (this.type === 'candles' || this.type === 'heikin') {
      for (i = v0; i <= v1; i++) {
        var k = d[i];
        var x = this.xAt(i) + this.barW / 2;
        var up = k.close >= k.open;
        var col = up ? th.up : th.down;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = Math.max(1, this.barW * 0.1);
        ctx.beginPath();
        ctx.moveTo(x, scale.y(k.high));
        ctx.lineTo(x, scale.y(k.low));
        ctx.stroke();
        var yO = scale.y(k.open), yC = scale.y(k.close);
        var top = Math.min(yO, yC), hh = Math.max(1, Math.abs(yC - yO));
        ctx.fillRect(x - bodyW / 2, top, bodyW, hh);
      }
    } else if (this.type === 'bars') {
      ctx.lineWidth = Math.max(1, Math.min(2, this.barW * 0.15));
      for (i = v0; i <= v1; i++) {
        var kb = d[i];
        var xb = this.xAt(i) + this.barW / 2;
        var colB = kb.close >= kb.open ? th.up : th.down;
        ctx.strokeStyle = colB;
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
      // línea / área
      ctx.beginPath();
      var started = false;
      for (i = v0; i <= v1; i++) {
        var xl = this.xAt(i) + this.barW / 2;
        var yl = scale.y(d[i].close);
        if (!started) { ctx.moveTo(xl, yl); started = true; }
        else ctx.lineTo(xl, yl);
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
          if (!started) { ctx.moveTo(xa, ya); started = true; }
          else ctx.lineTo(xa, ya);
        }
      }
      ctx.strokeStyle = th.areaLine;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // líneas de indicadores superpuestos
    this.indicators.forEach(function (ins) {
      if (ins.def.cat !== 'overlay' || !ins.visible || !ins.result) return;
      self._renderOutputs(ctx, ins, scale, i0, i1, null);
    });

    // dibujos del usuario
    this._renderDrawings(ctx, scale, plotW, pane);

    ctx.restore();

    // línea del último precio + etiqueta
    var lastRaw = this.candles[this.candles.length - 1];
    var lastD = d[n - 1];
    if (lastD) {
      var yLast = scale.y(lastD.close);
      if (yLast > pane.top && yLast < pane.top + pane.h) {
        var upLast = lastRaw.close >= lastRaw.open;
        var colLast = upLast ? th.up : th.down;
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
        this._axisLabel(ctx, plotW, yLast, fmtN(lastD.close, this.decimals), colLast, '#fff');
      }
    }
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
          if (!pen) { ctx.moveTo(x, y); pen = true; }
          else ctx.lineTo(x, y);
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
          var ck = self.candles[q];
          var upC = ck && ck.close >= ck.open;
          ctx.fillStyle = hexA(upC ? ins.colors[o.upKey] : ins.colors[o.dnKey], 0.55);
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

    // niveles de referencia (30/70, etc.)
    var self = this;
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
    var r = 3, x0 = plotW + 2, y0 = yy - 9, hh = 18;
    ctx.roundRect ? ctx.roundRect(x0, y0, w, hh, r) : ctx.rect(x0, y0, w, hh);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + 4, yy);
  };

  // ---------- crosshair ----------
  Chart.prototype._renderCrosshair = function () {
    var octx = this.octx, th = this.theme;
    var W = this.mount.clientWidth || 300;
    var H = this._canvasH;
    octx.clearRect(0, 0, W, H);

    var m = this._mouse;
    var n = this.candles.length;
    if (!m || !n || m.x > this._plotW() || m.y > H - this.axisH) {
      if (this.opts.onCrosshair) this.opts.onCrosshair(null);
      this._renderDrawPreview(octx);
      return;
    }

    var plotW = this._plotW();
    var fi = this.indexAt(m.x - this.barW / 2);
    var idx = clamp(Math.round(fi + 0), 0, n - 1);
    var snapX = this.xAt(idx) + this.barW / 2;

    octx.strokeStyle = th.crossLine;
    octx.lineWidth = 1;
    octx.setLineDash([4, 4]);

    // línea vertical en todos los paneles
    octx.beginPath();
    octx.moveTo(Math.round(snapX) + 0.5, 0);
    octx.lineTo(Math.round(snapX) + 0.5, H - this.axisH);
    octx.stroke();

    // línea horizontal en el panel activo
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
        var txt = isVol ? fmtVol(price) : fmtN(price, pane.kind === 'main' ? this.decimals : 2);
        this._axisLabelOverlay(octx, plotW, m.y, txt);
      }
    }
    octx.setLineDash([]);

    // etiqueta de tiempo
    var t = this.candles[idx] ? this.candles[idx].time : null;
    if (t != null) {
      var d = new Date(t);
      var txt2 = d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' \'' + ('' + d.getUTCFullYear()).slice(2);
      if (this.intervalMs < 86400e3) txt2 += '  ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
      octx.font = '10px -apple-system, sans-serif';
      var tw = octx.measureText(txt2).width + 14;
      var tx = clamp(snapX - tw / 2, 0, W - tw);
      octx.fillStyle = th.crossLabelBg;
      octx.beginPath();
      octx.roundRect ? octx.roundRect(tx, H - this.axisH + 3, tw, 18, 3) : octx.rect(tx, H - this.axisH + 3, tw, 18);
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
    octx.roundRect ? octx.roundRect(plotW + 2, yy - 9, this.scaleW - 4, 18, 3) : octx.rect(plotW + 2, yy - 9, this.scaleW - 4, 18);
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
    this.overlay.style.cursor = t === 'cursor' ? 'crosshair' : 'crosshair';
    this.requestRender();
  };

  Chart.prototype.getDrawings = function () {
    return this.drawings.map(function (d) {
      return { type: d.type, p1: d.p1, p2: d.p2, color: d.color };
    });
  };
  Chart.prototype.setDrawings = function (list) {
    this.drawings = (list || []).map(function (d, i) {
      return { id: 'd' + i, type: d.type, p1: d.p1, p2: d.p2, color: d.color || '#2962ff' };
    });
    Chart._dseq = this.drawings.length + 1;
    this.requestRender();
  };
  Chart._dseq = 1;

  Chart.prototype.clearDrawings = function () {
    this.drawings = [];
    this.selection = null;
    this.requestRender();
    if (this.opts.onDrawingsChange) this.opts.onDrawingsChange();
  };

  Chart.prototype.deleteSelected = function () {
    if (!this.selection) return;
    var id = this.selection.id;
    this.drawings = this.drawings.filter(function (d) { return d.id !== id; });
    this.selection = null;
    this.requestRender();
    if (this.opts.onDrawingsChange) this.opts.onDrawingsChange();
  };

  Chart.prototype._drawToScreen = function (pt, scale) {
    return {
      x: this.xAt(this.indexForTime(pt.t)) + this.barW / 2,
      y: scale.y(pt.price)
    };
  };

  Chart.prototype._screenToData = function (x, y, scale) {
    return {
      t: this.timeForIndex(this.indexAt(x - this.barW / 2)),
      price: scale.invert(y)
    };
  };

  Chart.prototype._renderDrawings = function (ctx, scale, plotW, pane) {
    var self = this;
    this.drawings.forEach(function (dr) {
      var sel = self.selection && self.selection.id === dr.id;
      self._renderDrawing(ctx, dr, scale, plotW, pane, sel);
    });
  };

  Chart.prototype._renderDrawing = function (ctx, dr, scale, plotW, pane, sel) {
    var th = this.theme;
    ctx.lineWidth = 2;
    ctx.strokeStyle = dr.color;
    var a = dr.p1 ? this._drawToScreen(dr.p1, scale) : null;
    var b = dr.p2 ? this._drawToScreen(dr.p2, scale) : null;

    if (dr.type === 'hline') {
      var y = Math.round(scale.y(dr.p1.price)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = dr.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(fmtN(dr.p1.price, this.decimals), 6, y - 3);
    } else if (dr.type === 'vline') {
      var x = Math.round(a.x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pane.top);
      ctx.lineTo(x, pane.top + pane.h);
      ctx.stroke();
    } else if (dr.type === 'trend' || dr.type === 'ray') {
      if (!b) return;
      var bx = b.x, by = b.y;
      if (dr.type === 'ray') {
        var dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > 0.01) {
          var ext = dx > 0 ? (plotW + 50 - a.x) / dx : (-50 - a.x) / dx;
          bx = a.x + dx * ext;
          by = a.y + dy * ext;
        }
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bx, by);
      ctx.stroke();
    } else if (dr.type === 'rect') {
      if (!b) return;
      var x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
      var w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      ctx.fillStyle = hexA(dr.color, 0.12);
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
    } else if (dr.type === 'fib') {
      if (!b) return;
      var xL = Math.min(a.x, b.x), xR = Math.max(a.x, b.x);
      var p1 = dr.p1.price, p2 = dr.p2.price;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      for (var i = 0; i < FIB_LEVELS.length; i++) {
        var lv = FIB_LEVELS[i];
        var pr = p2 + (p1 - p2) * lv;
        var yF = Math.round(scale.y(pr)) + 0.5;
        ctx.strokeStyle = FIB_COLORS[i];
        ctx.beginPath();
        ctx.moveTo(xL, yF);
        ctx.lineTo(xR, yF);
        ctx.stroke();
        ctx.fillStyle = FIB_COLORS[i];
        ctx.fillText(lv.toFixed(3) + '  (' + fmtN(pr, this.decimals) + ')', xL + 4, yF - 2);
        if (i > 0) {
          var prPrev = p2 + (p1 - p2) * FIB_LEVELS[i - 1];
          ctx.fillStyle = hexA(FIB_COLORS[i], 0.07);
          ctx.fillRect(xL, Math.min(yF, scale.y(prPrev)), xR - xL, Math.abs(yF - scale.y(prPrev)));
        }
      }
    }

    if (sel) {
      var th2 = this.theme;
      [a, b].forEach(function (pt) {
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
    var tmp = {
      id: '_tmp', type: st.tool,
      p1: st.p1,
      p2: this._screenToData(m.x, clamp(m.y, pane.top, pane.top + pane.h), this._mainScale),
      color: '#2962ff'
    };
    octx.save();
    octx.beginPath();
    octx.rect(0, pane.top, this._plotW(), pane.h);
    octx.clip();
    this._renderDrawing(octx, tmp, this._mainScale, this._plotW(), pane, false);
    octx.restore();
  };

  Chart.prototype._hitTestDrawing = function (x, y) {
    if (!this._mainScale) return null;
    var scale = this._mainScale;
    var pane = this._paneRects[0];
    if (y > pane.top + pane.h) return null;
    var TOL = 7;
    function distSeg(px, py, x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1;
      var len2 = dx * dx + dy * dy;
      var t = len2 ? clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1) : 0;
      var cx = x1 + t * dx, cy = y1 + t * dy;
      return Math.hypot(px - cx, py - cy);
    }
    for (var i = this.drawings.length - 1; i >= 0; i--) {
      var dr = this.drawings[i];
      var a = dr.p1 ? this._drawToScreen(dr.p1, scale) : null;
      var b = dr.p2 ? this._drawToScreen(dr.p2, scale) : null;
      // asas primero
      if (a && Math.hypot(x - a.x, y - a.y) < TOL) return { dr: dr, handle: 'p1' };
      if (b && Math.hypot(x - b.x, y - b.y) < TOL) return { dr: dr, handle: 'p2' };
      var hit = false;
      if (dr.type === 'hline') hit = Math.abs(y - scale.y(dr.p1.price)) < TOL;
      else if (dr.type === 'vline') hit = Math.abs(x - a.x) < TOL;
      else if (dr.type === 'trend') hit = b && distSeg(x, y, a.x, a.y, b.x, b.y) < TOL;
      else if (dr.type === 'ray') {
        if (b) {
          var dx = b.x - a.x, dy = b.y - a.y;
          var bx = b.x, by = b.y;
          if (Math.abs(dx) > 0.01) {
            var ext = dx > 0 ? (this._plotW() + 50 - a.x) / dx : (-50 - a.x) / dx;
            bx = a.x + dx * ext;
            by = a.y + dy * ext;
          }
          hit = distSeg(x, y, a.x, a.y, bx, by) < TOL;
        }
      } else if (dr.type === 'rect') {
        if (b) {
          var x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
          var x1r = Math.max(a.x, b.x), y1r = Math.max(a.y, b.y);
          hit = (x >= x0 - TOL && x <= x1r + TOL && y >= y0 - TOL && y <= y1r + TOL) &&
            !(x > x0 + TOL && x < x1r - TOL && y > y0 + TOL && y < y1r - TOL);
          if (!hit && x >= x0 && x <= x1r && y >= y0 && y <= y1r) hit = true;
        }
      } else if (dr.type === 'fib') {
        if (b) {
          var xL = Math.min(a.x, b.x), xR = Math.max(a.x, b.x);
          for (var f = 0; f < FIB_LEVELS.length; f++) {
            var pr = dr.p2.price + (dr.p1.price - dr.p2.price) * FIB_LEVELS[f];
            if (x >= xL - TOL && x <= xR + TOL && Math.abs(y - scale.y(pr)) < TOL) { hit = true; break; }
          }
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

    el.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      var p = pos(ev);
      var m = self._mainScale;

      if (self.tool !== 'cursor' && m) {
        var pane0 = self._paneRects[0];
        if (p.y <= pane0.top + pane0.h && p.x <= self._plotW()) {
          var dp = self._screenToData(p.x, p.y, m);
          if (self.tool === 'hline' || self.tool === 'vline') {
            self.drawings.push({ id: 'd' + (Chart._dseq++), type: self.tool, p1: dp, p2: null, color: '#2962ff' });
            self.setTool('cursor');
            if (self.opts.onToolDone) self.opts.onToolDone();
            if (self.opts.onDrawingsChange) self.opts.onDrawingsChange();
            self.requestRender();
          } else if (!self._drawState) {
            self._drawState = { tool: self.tool, p1: dp };
          } else {
            var d2 = self._screenToData(p.x, p.y, m);
            self.drawings.push({ id: 'd' + (Chart._dseq++), type: self._drawState.tool, p1: self._drawState.p1, p2: d2, color: '#2962ff' });
            self._drawState = null;
            self.setTool('cursor');
            if (self.opts.onToolDone) self.opts.onToolDone();
            if (self.opts.onDrawingsChange) self.opts.onDrawingsChange();
            self.requestRender();
          }
          return;
        }
      }

      // selección / arrastre de dibujos
      var hitD = self._hitTestDrawing(p.x, p.y);
      if (hitD) {
        self.selection = hitD.dr;
        self._pan = null;
        self._dragDraw = {
          dr: hitD.dr, handle: hitD.handle,
          startX: p.x, startY: p.y,
          o1: hitD.dr.p1 ? { t: hitD.dr.p1.t, price: hitD.dr.p1.price } : null,
          o2: hitD.dr.p2 ? { t: hitD.dr.p2.t, price: hitD.dr.p2.price } : null
        };
        self.requestRender();
        return;
      }
      if (self.selection) { self.selection = null; self.requestRender(); }

      self._pan = { startX: p.x, startRI: self.rightIndex };
      el.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', function (ev) {
      var p = pos(ev);
      self._mouse = p;

      if (self._dragDraw && self._mainScale) {
        var dd = self._dragDraw;
        var dT = self.timeForIndex(self.indexAt(p.x)) - self.timeForIndex(self.indexAt(dd.startX));
        var dP = self._mainScale.invert(p.y) - self._mainScale.invert(dd.startY);
        if (dd.handle === 'p1' && dd.o1) { dd.dr.p1 = { t: dd.o1.t + dT, price: dd.o1.price + dP }; }
        else if (dd.handle === 'p2' && dd.o2) { dd.dr.p2 = { t: dd.o2.t + dT, price: dd.o2.price + dP }; }
        else {
          if (dd.o1) dd.dr.p1 = { t: dd.o1.t + dT, price: dd.o1.price + dP };
          if (dd.o2) dd.dr.p2 = { t: dd.o2.t + dT, price: dd.o2.price + dP };
        }
        self.requestRender();
        return;
      }

      if (self._pan) {
        var dx = p.x - self._pan.startX;
        self.rightIndex = self._pan.startRI - dx / self.barW;
        self.requestRender();
        return;
      }

      self._dirty = true; // refresco del crosshair
    });

    window.addEventListener('mouseup', function () {
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
      var newW = clamp(self.barW * factor, 0.5, 60);
      self.rightIndex = fi + (self._plotW() - p.x) / newW;
      self.barW = newW;
      self.requestRender();
    }, { passive: false });

    el.addEventListener('dblclick', function () {
      if (!self.candles.length) return;
      var plotW = self._plotW();
      self.barW = clamp(plotW / Math.max(60, Math.min(180, self.candles.length)), 2, 20);
      self.rightIndex = self.candles.length - 1 + Math.max(4, Math.round(plotW / self.barW * 0.06));
      self.requestRender();
    });

    // táctil
    el.addEventListener('touchstart', function (ev) {
      if (ev.touches.length === 1) {
        var r = el.getBoundingClientRect();
        self._pan = { startX: ev.touches[0].clientX - r.left, startRI: self.rightIndex };
      } else if (ev.touches.length === 2) {
        self._pan = null;
        self._pinch = { d: Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY), barW: self.barW };
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
        self.barW = clamp(self._pinch.barW * d / self._pinch.d, 0.5, 60);
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
      } else if (ev.key === 'ArrowLeft') {
        self.rightIndex -= 10; self.requestRender();
      } else if (ev.key === 'ArrowRight') {
        self.rightIndex += 10; self.requestRender();
      } else if (ev.key === '+' || ev.key === '=') {
        self.barW = clamp(self.barW * 1.15, 0.5, 60); self.requestRender();
      } else if (ev.key === '-') {
        self.barW = clamp(self.barW / 1.15, 0.5, 60); self.requestRender();
      }
    });
  };

  Chart.prototype.historyLoaded = function () {
    this._loadingHistory = false;
  };

  Chart.prototype.snapshot = function (title) {
    var W = this.canvas.width, H = this.canvas.height;
    var tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H + 40 * (window.devicePixelRatio || 1);
    var t = tmp.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    t.fillStyle = this.theme.bg;
    t.fillRect(0, 0, tmp.width, tmp.height);
    t.font = 700 * 1 + ' ' + 16 * dpr + 'px -apple-system, sans-serif';
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
})();
