/* LibreCharts — librería de indicadores técnicos.
 * Todos los cálculos trabajan sobre arrays alineados con las velas;
 * los huecos de calentamiento se rellenan con null. */
(function () {
  'use strict';
  window.TV = window.TV || {};

  // ---------- utilidades de series ----------
  function arr(n) { return new Array(n).fill(null); }

  function srcArr(c, s) {
    var out = new Array(c.length);
    for (var i = 0; i < c.length; i++) {
      var k = c[i];
      switch (s) {
        case 'open': out[i] = k.open; break;
        case 'high': out[i] = k.high; break;
        case 'low': out[i] = k.low; break;
        case 'hl2': out[i] = (k.high + k.low) / 2; break;
        case 'hlc3': out[i] = (k.high + k.low + k.close) / 3; break;
        case 'ohlc4': out[i] = (k.open + k.high + k.low + k.close) / 4; break;
        default: out[i] = k.close;
      }
    }
    return out;
  }

  function sma(v, p) {
    var out = arr(v.length), sum = 0, cnt = 0;
    for (var i = 0; i < v.length; i++) {
      if (v[i] == null) { out[i] = null; sum = 0; cnt = 0; continue; }
      sum += v[i]; cnt++;
      if (cnt > p) { sum -= v[i - p]; cnt = p; }
      out[i] = cnt === p ? sum / p : null;
    }
    return out;
  }

  function emaK(v, p, k) {
    var out = arr(v.length), prev = null, sum = 0, cnt = 0;
    for (var i = 0; i < v.length; i++) {
      var x = v[i];
      if (x == null) { out[i] = null; prev = null; sum = 0; cnt = 0; continue; }
      if (prev == null) {
        sum += x; cnt++;
        if (cnt === p) { prev = sum / p; out[i] = prev; }
      } else {
        prev = x * k + prev * (1 - k);
        out[i] = prev;
      }
    }
    return out;
  }
  function ema(v, p) { return emaK(v, p, 2 / (p + 1)); }
  function rma(v, p) { return emaK(v, p, 1 / p); } // suavizado de Wilder

  function wma(v, p) {
    var out = arr(v.length), den = p * (p + 1) / 2;
    for (var i = p - 1; i < v.length; i++) {
      var s = 0, ok = true;
      for (var j = 0; j < p; j++) {
        var x = v[i - j];
        if (x == null) { ok = false; break; }
        s += x * (p - j);
      }
      out[i] = ok ? s / den : null;
    }
    return out;
  }

  function stdev(v, p) {
    var out = arr(v.length);
    for (var i = p - 1; i < v.length; i++) {
      var s = 0, ok = true, j, x;
      for (j = 0; j < p; j++) { x = v[i - j]; if (x == null) { ok = false; break; } s += x; }
      if (!ok) continue;
      var m = s / p, q = 0;
      for (j = 0; j < p; j++) { x = v[i - j]; q += (x - m) * (x - m); }
      out[i] = Math.sqrt(q / p);
    }
    return out;
  }

  function highest(v, p) {
    var out = arr(v.length);
    for (var i = p - 1; i < v.length; i++) {
      var h = -Infinity, ok = true;
      for (var j = 0; j < p; j++) { var x = v[i - j]; if (x == null) { ok = false; break; } if (x > h) h = x; }
      out[i] = ok ? h : null;
    }
    return out;
  }
  function lowest(v, p) {
    var out = arr(v.length);
    for (var i = p - 1; i < v.length; i++) {
      var l = Infinity, ok = true;
      for (var j = 0; j < p; j++) { var x = v[i - j]; if (x == null) { ok = false; break; } if (x < l) l = x; }
      out[i] = ok ? l : null;
    }
    return out;
  }

  function rollSum(v, p) {
    var out = arr(v.length), sum = 0, cnt = 0;
    for (var i = 0; i < v.length; i++) {
      if (v[i] == null) { out[i] = null; sum = 0; cnt = 0; continue; }
      sum += v[i]; cnt++;
      if (cnt > p) { sum -= v[i - p]; cnt = p; }
      out[i] = cnt === p ? sum : null;
    }
    return out;
  }

  function trueRange(c) {
    var out = new Array(c.length);
    for (var i = 0; i < c.length; i++) {
      if (i === 0) { out[i] = c[i].high - c[i].low; continue; }
      var pc = c[i - 1].close;
      out[i] = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - pc), Math.abs(c[i].low - pc));
    }
    return out;
  }
  function atr(c, p) { return rma(trueRange(c), p); }

  function rsiOf(v, p) {
    var up = arr(v.length), dn = arr(v.length);
    for (var i = 1; i < v.length; i++) {
      if (v[i] == null || v[i - 1] == null) continue;
      var d = v[i] - v[i - 1];
      up[i] = d > 0 ? d : 0;
      dn[i] = d < 0 ? -d : 0;
    }
    var au = rma(up, p), ad = rma(dn, p), out = arr(v.length);
    for (var j = 0; j < v.length; j++) {
      if (au[j] == null || ad[j] == null) continue;
      out[j] = ad[j] === 0 ? 100 : 100 - 100 / (1 + au[j] / ad[j]);
    }
    return out;
  }

  function stochOf(hi, lo, cl, kP, kS, dS) {
    var hh = highest(hi, kP), ll = lowest(lo, kP), raw = arr(cl.length);
    for (var i = 0; i < cl.length; i++) {
      if (hh[i] == null || ll[i] == null || cl[i] == null) continue;
      var rng = hh[i] - ll[i];
      raw[i] = rng === 0 ? 50 : (cl[i] - ll[i]) / rng * 100;
    }
    var k = sma(raw, kS), d = sma(k, dS);
    return { k: k, d: d };
  }

  // ---------- catálogo de indicadores ----------
  // params: {k, label, type:'int'|'float'|'source', def, min, max, step}
  // colors: {k, label, def}  (def null → color automático de la paleta)
  // compute(candles, p) → { outputs:[...], levels:[], fixedRange:{min,max}|null }
  var SOURCES = [['close', 'Cierre'], ['open', 'Apertura'], ['high', 'Máximo'], ['low', 'Mínimo'], ['hl2', 'HL/2'], ['hlc3', 'HLC/3'], ['ohlc4', 'OHLC/4']];

  var defs = [
    // ============ SUPERPOSICIONES (panel principal) ============
    {
      key: 'sma', name: 'Media Móvil Simple', short: 'SMA', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 1, max: 500 }, { k: 'source', label: 'Fuente', type: 'source', def: 'close' }],
      colors: [{ k: 'line', label: 'Línea', def: null }],
      compute: function (c, p) {
        return { outputs: [{ kind: 'line', key: 'v', values: sma(srcArr(c, p.source), p.period), colorKey: 'line', width: 2 }] };
      }
    },
    {
      key: 'ema', name: 'Media Móvil Exponencial', short: 'EMA', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 1, max: 500 }, { k: 'source', label: 'Fuente', type: 'source', def: 'close' }],
      colors: [{ k: 'line', label: 'Línea', def: null }],
      compute: function (c, p) {
        return { outputs: [{ kind: 'line', key: 'v', values: ema(srcArr(c, p.source), p.period), colorKey: 'line', width: 2 }] };
      }
    },
    {
      key: 'wma', name: 'Media Móvil Ponderada', short: 'WMA', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 1, max: 300 }, { k: 'source', label: 'Fuente', type: 'source', def: 'close' }],
      colors: [{ k: 'line', label: 'Línea', def: null }],
      compute: function (c, p) {
        return { outputs: [{ kind: 'line', key: 'v', values: wma(srcArr(c, p.source), p.period), colorKey: 'line', width: 2 }] };
      }
    },
    {
      key: 'hma', name: 'Media Móvil de Hull', short: 'HMA', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 21, min: 2, max: 300 }],
      colors: [{ k: 'line', label: 'Línea', def: null }],
      compute: function (c, p) {
        var s = srcArr(c, 'close'), half = Math.max(1, Math.round(p.period / 2));
        var a = wma(s, half), b = wma(s, p.period), diff = arr(s.length);
        for (var i = 0; i < s.length; i++) if (a[i] != null && b[i] != null) diff[i] = 2 * a[i] - b[i];
        return { outputs: [{ kind: 'line', key: 'v', values: wma(diff, Math.max(1, Math.round(Math.sqrt(p.period)))), colorKey: 'line', width: 2 }] };
      }
    },
    {
      key: 'dema', name: 'Media Móvil Exponencial Doble', short: 'DEMA', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 21, min: 1, max: 300 }],
      colors: [{ k: 'line', label: 'Línea', def: null }],
      compute: function (c, p) {
        var e1 = ema(srcArr(c, 'close'), p.period), e2 = ema(e1, p.period), out = arr(e1.length);
        for (var i = 0; i < e1.length; i++) if (e1[i] != null && e2[i] != null) out[i] = 2 * e1[i] - e2[i];
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 2 }] };
      }
    },
    {
      key: 'tema', name: 'Media Móvil Exponencial Triple', short: 'TEMA', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 21, min: 1, max: 300 }],
      colors: [{ k: 'line', label: 'Línea', def: null }],
      compute: function (c, p) {
        var e1 = ema(srcArr(c, 'close'), p.period), e2 = ema(e1, p.period), e3 = ema(e2, p.period), out = arr(e1.length);
        for (var i = 0; i < e1.length; i++) if (e1[i] != null && e2[i] != null && e3[i] != null) out[i] = 3 * e1[i] - 3 * e2[i] + e3[i];
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 2 }] };
      }
    },
    {
      key: 'vwap', name: 'VWAP (precio medio ponderado por volumen)', short: 'VWAP', cat: 'overlay',
      params: [],
      colors: [{ k: 'line', label: 'Línea', def: '#ff9800' }],
      compute: function (c, p, ctx) {
        var out = arr(c.length), cumPV = 0, cumV = 0, day = -1;
        var intraday = ctx && ctx.intervalMs < 86400000;
        for (var i = 0; i < c.length; i++) {
          if (intraday) {
            var d = Math.floor(c[i].time / 86400000);
            if (d !== day) { day = d; cumPV = 0; cumV = 0; }
          }
          var tp = (c[i].high + c[i].low + c[i].close) / 3;
          cumPV += tp * c[i].volume; cumV += c[i].volume;
          out[i] = cumV > 0 ? cumPV / cumV : null;
        }
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 2 }] };
      }
    },
    {
      key: 'bb', name: 'Bandas de Bollinger', short: 'BB', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 2, max: 300 }, { k: 'mult', label: 'Desv. estándar', type: 'float', def: 2, min: 0.1, max: 10, step: 0.1 }, { k: 'source', label: 'Fuente', type: 'source', def: 'close' }],
      colors: [{ k: 'basis', label: 'Media', def: '#ff6d00' }, { k: 'band', label: 'Bandas', def: '#2962ff' }],
      compute: function (c, p) {
        var s = srcArr(c, p.source), m = sma(s, p.period), sd = stdev(s, p.period);
        var up = arr(s.length), lo = arr(s.length);
        for (var i = 0; i < s.length; i++) if (m[i] != null && sd[i] != null) { up[i] = m[i] + p.mult * sd[i]; lo[i] = m[i] - p.mult * sd[i]; }
        return {
          outputs: [
            { kind: 'fill', a: 'up', b: 'lo', colorKey: 'band' },
            { kind: 'line', key: 'basis', values: m, colorKey: 'basis', width: 1 },
            { kind: 'line', key: 'up', values: up, colorKey: 'band', width: 1 },
            { kind: 'line', key: 'lo', values: lo, colorKey: 'band', width: 1 }
          ]
        };
      }
    },
    {
      key: 'keltner', name: 'Canales de Keltner', short: 'KC', cat: 'overlay',
      params: [{ k: 'period', label: 'Período EMA', type: 'int', def: 20, min: 2, max: 300 }, { k: 'atrp', label: 'Período ATR', type: 'int', def: 10, min: 1, max: 200 }, { k: 'mult', label: 'Multiplicador', type: 'float', def: 2, min: 0.1, max: 10, step: 0.1 }],
      colors: [{ k: 'basis', label: 'Media', def: '#ab47bc' }, { k: 'band', label: 'Bandas', def: '#ab47bc' }],
      compute: function (c, p) {
        var m = ema(srcArr(c, 'close'), p.period), a = atr(c, p.atrp);
        var up = arr(c.length), lo = arr(c.length);
        for (var i = 0; i < c.length; i++) if (m[i] != null && a[i] != null) { up[i] = m[i] + p.mult * a[i]; lo[i] = m[i] - p.mult * a[i]; }
        return {
          outputs: [
            { kind: 'fill', a: 'up', b: 'lo', colorKey: 'band' },
            { kind: 'line', key: 'basis', values: m, colorKey: 'basis', width: 1, dash: [4, 3] },
            { kind: 'line', key: 'up', values: up, colorKey: 'band', width: 1 },
            { kind: 'line', key: 'lo', values: lo, colorKey: 'band', width: 1 }
          ]
        };
      }
    },
    {
      key: 'donchian', name: 'Canales de Donchian', short: 'DC', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 2, max: 300 }],
      colors: [{ k: 'basis', label: 'Media', def: '#26c6da' }, { k: 'band', label: 'Bandas', def: '#26c6da' }],
      compute: function (c, p) {
        var hi = srcArr(c, 'high'), lo = srcArr(c, 'low');
        var up = highest(hi, p.period), dn = lowest(lo, p.period), mid = arr(c.length);
        for (var i = 0; i < c.length; i++) if (up[i] != null && dn[i] != null) mid[i] = (up[i] + dn[i]) / 2;
        return {
          outputs: [
            { kind: 'fill', a: 'up', b: 'lo', colorKey: 'band' },
            { kind: 'line', key: 'basis', values: mid, colorKey: 'basis', width: 1, dash: [4, 3] },
            { kind: 'line', key: 'up', values: up, colorKey: 'band', width: 1 },
            { kind: 'line', key: 'lo', values: dn, colorKey: 'band', width: 1 }
          ]
        };
      }
    },
    {
      key: 'env', name: 'Envolventes (Envelopes)', short: 'ENV', cat: 'overlay',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 1, max: 300 }, { k: 'pct', label: 'Porcentaje %', type: 'float', def: 2, min: 0.05, max: 50, step: 0.05 }],
      colors: [{ k: 'basis', label: 'Media', def: '#66bb6a' }, { k: 'band', label: 'Bandas', def: '#66bb6a' }],
      compute: function (c, p) {
        var m = sma(srcArr(c, 'close'), p.period), up = arr(c.length), lo = arr(c.length);
        for (var i = 0; i < c.length; i++) if (m[i] != null) { up[i] = m[i] * (1 + p.pct / 100); lo[i] = m[i] * (1 - p.pct / 100); }
        return {
          outputs: [
            { kind: 'fill', a: 'up', b: 'lo', colorKey: 'band' },
            { kind: 'line', key: 'basis', values: m, colorKey: 'basis', width: 1, dash: [4, 3] },
            { kind: 'line', key: 'up', values: up, colorKey: 'band', width: 1 },
            { kind: 'line', key: 'lo', values: lo, colorKey: 'band', width: 1 }
          ]
        };
      }
    },
    {
      key: 'psar', name: 'SAR Parabólico', short: 'PSAR', cat: 'overlay',
      params: [{ k: 'step', label: 'Incremento', type: 'float', def: 0.02, min: 0.001, max: 0.2, step: 0.001 }, { k: 'max', label: 'Máximo', type: 'float', def: 0.2, min: 0.01, max: 1, step: 0.01 }],
      colors: [{ k: 'dots', label: 'Puntos', def: '#2962ff' }],
      compute: function (c, p) {
        var out = arr(c.length);
        if (c.length < 2) return { outputs: [{ kind: 'dots', key: 'v', values: out, colorKey: 'dots' }] };
        var upTrend = c[1].close >= c[0].close;
        var sar = upTrend ? c[0].low : c[0].high;
        var ep = upTrend ? c[0].high : c[0].low;
        var af = p.step;
        for (var i = 1; i < c.length; i++) {
          sar = sar + af * (ep - sar);
          if (upTrend) {
            sar = Math.min(sar, c[i - 1].low, i >= 2 ? c[i - 2].low : c[i - 1].low);
            if (c[i].low < sar) { upTrend = false; sar = ep; ep = c[i].low; af = p.step; }
            else { if (c[i].high > ep) { ep = c[i].high; af = Math.min(p.max, af + p.step); } }
          } else {
            sar = Math.max(sar, c[i - 1].high, i >= 2 ? c[i - 2].high : c[i - 1].high);
            if (c[i].high > sar) { upTrend = true; sar = ep; ep = c[i].high; af = p.step; }
            else { if (c[i].low < ep) { ep = c[i].low; af = Math.min(p.max, af + p.step); } }
          }
          out[i] = sar;
        }
        return { outputs: [{ kind: 'dots', key: 'v', values: out, colorKey: 'dots' }] };
      }
    },
    {
      key: 'supertrend', name: 'SuperTrend', short: 'ST', cat: 'overlay',
      params: [{ k: 'period', label: 'Período ATR', type: 'int', def: 10, min: 1, max: 200 }, { k: 'mult', label: 'Multiplicador', type: 'float', def: 3, min: 0.5, max: 15, step: 0.1 }],
      colors: [{ k: 'up', label: 'Alcista', def: '#26a69a' }, { k: 'down', label: 'Bajista', def: '#ef5350' }],
      compute: function (c, p) {
        var a = atr(c, p.period), n = c.length;
        var stUp = arr(n), stDn = arr(n);
        var fub = null, flb = null, trend = 1;
        for (var i = 0; i < n; i++) {
          if (a[i] == null) continue;
          var hl2 = (c[i].high + c[i].low) / 2;
          var ub = hl2 + p.mult * a[i], lb = hl2 - p.mult * a[i];
          var pc = i > 0 ? c[i - 1].close : c[i].close;
          fub = (fub == null || ub < fub || pc > fub) ? ub : fub;
          flb = (flb == null || lb > flb || pc < flb) ? lb : flb;
          if (trend === 1 && c[i].close < flb) trend = -1;
          else if (trend === -1 && c[i].close > fub) trend = 1;
          if (trend === 1) stUp[i] = flb; else stDn[i] = fub;
        }
        return {
          outputs: [
            { kind: 'line', key: 'up', values: stUp, colorKey: 'up', width: 2 },
            { kind: 'line', key: 'dn', values: stDn, colorKey: 'down', width: 2 }
          ]
        };
      }
    },
    {
      key: 'ichimoku', name: 'Nube de Ichimoku', short: 'ICHI', cat: 'overlay',
      params: [{ k: 'tenkan', label: 'Tenkan-sen', type: 'int', def: 9, min: 1, max: 100 }, { k: 'kijun', label: 'Kijun-sen', type: 'int', def: 26, min: 1, max: 200 }, { k: 'senkou', label: 'Senkou B', type: 'int', def: 52, min: 1, max: 300 }],
      colors: [
        { k: 'tenkan', label: 'Tenkan', def: '#2962ff' }, { k: 'kijun', label: 'Kijun', def: '#b71c1c' },
        { k: 'chikou', label: 'Chikou', def: '#43a047' }, { k: 'cloudUp', label: 'Nube alcista', def: '#26a69a' }, { k: 'cloudDn', label: 'Nube bajista', def: '#ef5350' }
      ],
      compute: function (c, p) {
        var n = c.length, disp = p.kijun;
        var hi = srcArr(c, 'high'), lo = srcArr(c, 'low');
        function midline(per) {
          var h = highest(hi, per), l = lowest(lo, per), m = arr(n);
          for (var i = 0; i < n; i++) if (h[i] != null && l[i] != null) m[i] = (h[i] + l[i]) / 2;
          return m;
        }
        var tenkan = midline(p.tenkan), kijun = midline(p.kijun), sb0 = midline(p.senkou);
        var senkouA = arr(n + disp), senkouB = arr(n + disp), chikou = arr(n);
        for (var i = 0; i < n; i++) {
          if (tenkan[i] != null && kijun[i] != null) senkouA[i + disp] = (tenkan[i] + kijun[i]) / 2;
          if (sb0[i] != null) senkouB[i + disp] = sb0[i];
          if (i + disp < n) chikou[i] = c[i + disp].close;
        }
        return {
          outputs: [
            { kind: 'cloud', a: 'sa', b: 'sb', colorUpKey: 'cloudUp', colorDnKey: 'cloudDn' },
            { kind: 'line', key: 'tenkan', values: tenkan, colorKey: 'tenkan', width: 1 },
            { kind: 'line', key: 'kijun', values: kijun, colorKey: 'kijun', width: 1 },
            { kind: 'line', key: 'chikou', values: chikou, colorKey: 'chikou', width: 1 },
            { kind: 'line', key: 'sa', values: senkouA, colorKey: 'cloudUp', width: 1 },
            { kind: 'line', key: 'sb', values: senkouB, colorKey: 'cloudDn', width: 1 }
          ]
        };
      }
    },

    // ============ OSCILADORES (panel propio) ============
    {
      key: 'volume', name: 'Volumen', short: 'Vol', cat: 'oscillator',
      params: [{ k: 'maPeriod', label: 'Período de la media', type: 'int', def: 20, min: 1, max: 300 }],
      colors: [{ k: 'up', label: 'Alcista', def: '#26a69a' }, { k: 'down', label: 'Bajista', def: '#ef5350' }, { k: 'ma', label: 'Media', def: '#ff9800' }],
      compute: function (c, p) {
        var v = new Array(c.length);
        for (var i = 0; i < c.length; i++) v[i] = c[i].volume;
        return {
          isVolume: true,
          outputs: [
            { kind: 'vhist', key: 'v', values: v, upKey: 'up', dnKey: 'down' },
            { kind: 'line', key: 'ma', values: sma(v, p.maPeriod), colorKey: 'ma', width: 1 }
          ]
        };
      }
    },
    {
      key: 'rsi', name: 'Índice de Fuerza Relativa (RSI)', short: 'RSI', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 14, min: 2, max: 200 }, { k: 'source', label: 'Fuente', type: 'source', def: 'close' }],
      colors: [{ k: 'line', label: 'RSI', def: '#ab47bc' }],
      compute: function (c, p) {
        return {
          outputs: [{ kind: 'line', key: 'v', values: rsiOf(srcArr(c, p.source), p.period), colorKey: 'line', width: 2 }],
          levels: [{ v: 70 }, { v: 50, faint: true }, { v: 30 }],
          fixedRange: { min: 0, max: 100 }
        };
      }
    },
    {
      key: 'macd', name: 'MACD (convergencia/divergencia)', short: 'MACD', cat: 'oscillator',
      params: [{ k: 'fast', label: 'EMA rápida', type: 'int', def: 12, min: 1, max: 200 }, { k: 'slow', label: 'EMA lenta', type: 'int', def: 26, min: 1, max: 300 }, { k: 'signal', label: 'Señal', type: 'int', def: 9, min: 1, max: 100 }],
      colors: [{ k: 'macd', label: 'MACD', def: '#2962ff' }, { k: 'signal', label: 'Señal', def: '#ff6d00' }, { k: 'hup', label: 'Histograma +', def: '#26a69a' }, { k: 'hdn', label: 'Histograma −', def: '#ef5350' }],
      compute: function (c, p) {
        var s = srcArr(c, 'close'), f = ema(s, p.fast), sl = ema(s, p.slow);
        var macd = arr(s.length);
        for (var i = 0; i < s.length; i++) if (f[i] != null && sl[i] != null) macd[i] = f[i] - sl[i];
        var sig = ema(macd, p.signal), hist = arr(s.length);
        for (var j = 0; j < s.length; j++) if (macd[j] != null && sig[j] != null) hist[j] = macd[j] - sig[j];
        return {
          outputs: [
            { kind: 'hist', key: 'h', values: hist, upKey: 'hup', dnKey: 'hdn' },
            { kind: 'line', key: 'macd', values: macd, colorKey: 'macd', width: 1.5 },
            { kind: 'line', key: 'sig', values: sig, colorKey: 'signal', width: 1.5 }
          ],
          levels: [{ v: 0, faint: true }]
        };
      }
    },
    {
      key: 'stoch', name: 'Oscilador Estocástico', short: 'Estoc', cat: 'oscillator',
      params: [{ k: 'kP', label: '%K período', type: 'int', def: 14, min: 1, max: 200 }, { k: 'kS', label: '%K suavizado', type: 'int', def: 3, min: 1, max: 50 }, { k: 'dS', label: '%D período', type: 'int', def: 3, min: 1, max: 50 }],
      colors: [{ k: 'k', label: '%K', def: '#2962ff' }, { k: 'd', label: '%D', def: '#ff6d00' }],
      compute: function (c, p) {
        var r = stochOf(srcArr(c, 'high'), srcArr(c, 'low'), srcArr(c, 'close'), p.kP, p.kS, p.dS);
        return {
          outputs: [
            { kind: 'line', key: 'k', values: r.k, colorKey: 'k', width: 1.5 },
            { kind: 'line', key: 'd', values: r.d, colorKey: 'd', width: 1.5 }
          ],
          levels: [{ v: 80 }, { v: 20 }],
          fixedRange: { min: 0, max: 100 }
        };
      }
    },
    {
      key: 'stochrsi', name: 'RSI Estocástico', short: 'StochRSI', cat: 'oscillator',
      params: [{ k: 'rsiP', label: 'RSI período', type: 'int', def: 14, min: 2, max: 200 }, { k: 'stochP', label: 'Estocástico', type: 'int', def: 14, min: 1, max: 200 }, { k: 'kS', label: '%K suavizado', type: 'int', def: 3, min: 1, max: 50 }, { k: 'dS', label: '%D período', type: 'int', def: 3, min: 1, max: 50 }],
      colors: [{ k: 'k', label: '%K', def: '#2962ff' }, { k: 'd', label: '%D', def: '#ff6d00' }],
      compute: function (c, p) {
        var r = rsiOf(srcArr(c, 'close'), p.rsiP);
        var s = stochOf(r, r, r, p.stochP, p.kS, p.dS);
        return {
          outputs: [
            { kind: 'line', key: 'k', values: s.k, colorKey: 'k', width: 1.5 },
            { kind: 'line', key: 'd', values: s.d, colorKey: 'd', width: 1.5 }
          ],
          levels: [{ v: 80 }, { v: 20 }],
          fixedRange: { min: 0, max: 100 }
        };
      }
    },
    {
      key: 'cci', name: 'Índice de Canal de Mercancías (CCI)', short: 'CCI', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 2, max: 200 }],
      colors: [{ k: 'line', label: 'CCI', def: '#26c6da' }],
      compute: function (c, p) {
        var tp = srcArr(c, 'hlc3'), m = sma(tp, p.period), out = arr(c.length);
        for (var i = p.period - 1; i < c.length; i++) {
          if (m[i] == null) continue;
          var dev = 0;
          for (var j = 0; j < p.period; j++) dev += Math.abs(tp[i - j] - m[i]);
          dev /= p.period;
          out[i] = dev === 0 ? 0 : (tp[i] - m[i]) / (0.015 * dev);
        }
        return {
          outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }],
          levels: [{ v: 100 }, { v: 0, faint: true }, { v: -100 }]
        };
      }
    },
    {
      key: 'atr', name: 'Rango Medio Verdadero (ATR)', short: 'ATR', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 14, min: 1, max: 200 }],
      colors: [{ k: 'line', label: 'ATR', def: '#ec407a' }],
      compute: function (c, p) {
        return { outputs: [{ kind: 'line', key: 'v', values: atr(c, p.period), colorKey: 'line', width: 1.5 }] };
      }
    },
    {
      key: 'adx', name: 'Índice Direccional Medio (ADX)', short: 'ADX', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 14, min: 2, max: 200 }],
      colors: [{ k: 'adx', label: 'ADX', def: '#f9a825' }, { k: 'dip', label: '+DI', def: '#26a69a' }, { k: 'dim', label: '−DI', def: '#ef5350' }],
      compute: function (c, p) {
        var n = c.length, pdm = arr(n), mdm = arr(n);
        for (var i = 1; i < n; i++) {
          var upM = c[i].high - c[i - 1].high, dnM = c[i - 1].low - c[i].low;
          pdm[i] = (upM > dnM && upM > 0) ? upM : 0;
          mdm[i] = (dnM > upM && dnM > 0) ? dnM : 0;
        }
        var a = atr(c, p.period), sp = rma(pdm, p.period), sm = rma(mdm, p.period);
        var dip = arr(n), dim = arr(n), dx = arr(n);
        for (var j = 0; j < n; j++) {
          if (a[j] == null || !a[j] || sp[j] == null || sm[j] == null) continue;
          dip[j] = 100 * sp[j] / a[j];
          dim[j] = 100 * sm[j] / a[j];
          var s = dip[j] + dim[j];
          dx[j] = s === 0 ? 0 : 100 * Math.abs(dip[j] - dim[j]) / s;
        }
        return {
          outputs: [
            { kind: 'line', key: 'adx', values: rma(dx, p.period), colorKey: 'adx', width: 2 },
            { kind: 'line', key: 'dip', values: dip, colorKey: 'dip', width: 1 },
            { kind: 'line', key: 'dim', values: dim, colorKey: 'dim', width: 1 }
          ],
          levels: [{ v: 25, faint: true }]
        };
      }
    },
    {
      key: 'obv', name: 'Volumen en Balance (OBV)', short: 'OBV', cat: 'oscillator',
      params: [],
      colors: [{ k: 'line', label: 'OBV', def: '#5c6bc0' }],
      compute: function (c) {
        var out = arr(c.length), acc = 0;
        for (var i = 0; i < c.length; i++) {
          if (i > 0) {
            if (c[i].close > c[i - 1].close) acc += c[i].volume;
            else if (c[i].close < c[i - 1].close) acc -= c[i].volume;
          }
          out[i] = acc;
        }
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }] };
      }
    },
    {
      key: 'mfi', name: 'Índice de Flujo de Dinero (MFI)', short: 'MFI', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 14, min: 2, max: 200 }],
      colors: [{ k: 'line', label: 'MFI', def: '#66bb6a' }],
      compute: function (c, p) {
        var n = c.length, pos = arr(n), neg = arr(n);
        var prevTp = null;
        for (var i = 0; i < n; i++) {
          var tp = (c[i].high + c[i].low + c[i].close) / 3, mf = tp * c[i].volume;
          if (prevTp != null) { pos[i] = tp > prevTp ? mf : 0; neg[i] = tp < prevTp ? mf : 0; }
          prevTp = tp;
        }
        var sp = rollSum(pos, p.period), sn = rollSum(neg, p.period), out = arr(n);
        for (var j = 0; j < n; j++) {
          if (sp[j] == null || sn[j] == null) continue;
          out[j] = sn[j] === 0 ? 100 : 100 - 100 / (1 + sp[j] / sn[j]);
        }
        return {
          outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }],
          levels: [{ v: 80 }, { v: 20 }],
          fixedRange: { min: 0, max: 100 }
        };
      }
    },
    {
      key: 'willr', name: 'Williams %R', short: '%R', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 14, min: 2, max: 200 }],
      colors: [{ k: 'line', label: '%R', def: '#29b6f6' }],
      compute: function (c, p) {
        var hh = highest(srcArr(c, 'high'), p.period), ll = lowest(srcArr(c, 'low'), p.period), out = arr(c.length);
        for (var i = 0; i < c.length; i++) {
          if (hh[i] == null || ll[i] == null) continue;
          var rng = hh[i] - ll[i];
          out[i] = rng === 0 ? -50 : (hh[i] - c[i].close) / rng * -100;
        }
        return {
          outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }],
          levels: [{ v: -20 }, { v: -80 }],
          fixedRange: { min: -100, max: 0 }
        };
      }
    },
    {
      key: 'mom', name: 'Momentum', short: 'Mom', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 10, min: 1, max: 200 }],
      colors: [{ k: 'line', label: 'Momentum', def: '#8d6e63' }],
      compute: function (c, p) {
        var s = srcArr(c, 'close'), out = arr(c.length);
        for (var i = p.period; i < c.length; i++) out[i] = s[i] - s[i - p.period];
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }], levels: [{ v: 0, faint: true }] };
      }
    },
    {
      key: 'roc', name: 'Tasa de Cambio (ROC)', short: 'ROC', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 12, min: 1, max: 200 }],
      colors: [{ k: 'line', label: 'ROC', def: '#00e676' }],
      compute: function (c, p) {
        var s = srcArr(c, 'close'), out = arr(c.length);
        for (var i = p.period; i < c.length; i++) if (s[i - p.period] !== 0) out[i] = (s[i] / s[i - p.period] - 1) * 100;
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }], levels: [{ v: 0, faint: true }] };
      }
    },
    {
      key: 'trix', name: 'TRIX', short: 'TRIX', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 18, min: 1, max: 200 }],
      colors: [{ k: 'line', label: 'TRIX', def: '#e040fb' }],
      compute: function (c, p) {
        var t = ema(ema(ema(srcArr(c, 'close'), p.period), p.period), p.period), out = arr(c.length);
        for (var i = 1; i < c.length; i++) if (t[i] != null && t[i - 1] != null && t[i - 1] !== 0) out[i] = (t[i] / t[i - 1] - 1) * 100;
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }], levels: [{ v: 0, faint: true }] };
      }
    },
    {
      key: 'ao', name: 'Oscilador Asombroso (AO)', short: 'AO', cat: 'oscillator',
      params: [{ k: 'fast', label: 'Rápido', type: 'int', def: 5, min: 1, max: 100 }, { k: 'slow', label: 'Lento', type: 'int', def: 34, min: 2, max: 300 }],
      colors: [{ k: 'up', label: 'Positivo', def: '#26a69a' }, { k: 'down', label: 'Negativo', def: '#ef5350' }],
      compute: function (c, p) {
        var hl = srcArr(c, 'hl2'), f = sma(hl, p.fast), s = sma(hl, p.slow), out = arr(c.length);
        for (var i = 0; i < c.length; i++) if (f[i] != null && s[i] != null) out[i] = f[i] - s[i];
        return { outputs: [{ kind: 'hist', key: 'v', values: out, upKey: 'up', dnKey: 'down' }], levels: [{ v: 0, faint: true }] };
      }
    },
    {
      key: 'uo', name: 'Oscilador Definitivo (UO)', short: 'UO', cat: 'oscillator',
      params: [{ k: 'p1', label: 'Corto', type: 'int', def: 7, min: 1, max: 100 }, { k: 'p2', label: 'Medio', type: 'int', def: 14, min: 1, max: 200 }, { k: 'p3', label: 'Largo', type: 'int', def: 28, min: 1, max: 300 }],
      colors: [{ k: 'line', label: 'UO', def: '#ffca28' }],
      compute: function (c, p) {
        var n = c.length, bp = arr(n), tr = arr(n);
        for (var i = 1; i < n; i++) {
          var pc = c[i - 1].close, lo = Math.min(c[i].low, pc), hi = Math.max(c[i].high, pc);
          bp[i] = c[i].close - lo;
          tr[i] = hi - lo;
        }
        var b1 = rollSum(bp, p.p1), t1 = rollSum(tr, p.p1);
        var b2 = rollSum(bp, p.p2), t2 = rollSum(tr, p.p2);
        var b3 = rollSum(bp, p.p3), t3 = rollSum(tr, p.p3);
        var out = arr(n);
        for (var j = 0; j < n; j++) {
          if (b3[j] == null || !t1[j] || !t2[j] || !t3[j]) continue;
          out[j] = 100 * (4 * (b1[j] / t1[j]) + 2 * (b2[j] / t2[j]) + (b3[j] / t3[j])) / 7;
        }
        return {
          outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }],
          levels: [{ v: 70 }, { v: 30 }],
          fixedRange: { min: 0, max: 100 }
        };
      }
    },
    {
      key: 'cmf', name: 'Flujo de Dinero de Chaikin (CMF)', short: 'CMF', cat: 'oscillator',
      params: [{ k: 'period', label: 'Período', type: 'int', def: 20, min: 1, max: 200 }],
      colors: [{ k: 'line', label: 'CMF', def: '#ff7043' }],
      compute: function (c, p) {
        var n = c.length, mfv = arr(n), vol = arr(n);
        for (var i = 0; i < n; i++) {
          var rng = c[i].high - c[i].low;
          var mfm = rng === 0 ? 0 : ((c[i].close - c[i].low) - (c[i].high - c[i].close)) / rng;
          mfv[i] = mfm * c[i].volume;
          vol[i] = c[i].volume;
        }
        var sm = rollSum(mfv, p.period), sv = rollSum(vol, p.period), out = arr(n);
        for (var j = 0; j < n; j++) if (sm[j] != null && sv[j]) out[j] = sm[j] / sv[j];
        return { outputs: [{ kind: 'line', key: 'v', values: out, colorKey: 'line', width: 1.5 }], levels: [{ v: 0, faint: true }] };
      }
    }
  ];

  var byKey = {};
  defs.forEach(function (d) { byKey[d.key] = d; });

  TV.Indicators = {
    defs: defs,
    byKey: byKey,
    SOURCES: SOURCES,
    compute: function (key, candles, params, ctx) {
      var d = byKey[key];
      if (!d) return { outputs: [] };
      try {
        return d.compute(candles, params, ctx) || { outputs: [] };
      } catch (e) {
        console.error('Error calculando ' + key, e);
        return { outputs: [] };
      }
    }
  };
})();
