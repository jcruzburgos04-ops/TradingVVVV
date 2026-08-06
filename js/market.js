/* LibreCharts — horarios y estado de cada mercado.
 *
 * Sirve para dos cosas: mostrar si el mercado está abierto o cerrado, y no
 * esperar cotizaciones nuevas cuando no las va a haber. Si el mercado está
 * cerrado el gráfico queda quieto en la última vela real — nunca se inventan
 * movimientos.
 *
 * Los feriados se calculan, no se listan a mano, así el archivo no se vence.
 * Aun así el calendario es aproximado: puede errarle a algún feriado puente o
 * a un cierre extraordinario. Ante la duda, el estado se corrige solo en
 * cuanto llega (o deja de llegar) un precio nuevo. */
(function () {
  'use strict';
  window.TV = window.TV || {};

  var SESSIONS = {
    crypto: { tz: 'UTC', open: 0, close: 24 * 60, days: [0, 1, 2, 3, 4, 5, 6], label: 'Cripto 24/7' },
    ar: { tz: 'America/Argentina/Buenos_Aires', open: 11 * 60, close: 17 * 60, days: [1, 2, 3, 4, 5], label: 'BYMA 11:00–17:00' },
    us: { tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60, days: [1, 2, 3, 4, 5], label: 'NYSE/Nasdaq 9:30–16:00' }
  };

  var partsCache = {};

  // Partes de la fecha en una zona horaria, sin depender del reloj del equipo.
  function partsIn(tz, ms) {
    var key = tz + '|' + Math.floor(ms / 60000);
    if (partsCache[key]) return partsCache[key];
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short'
    });
    var o = {};
    fmt.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var out = {
      y: +o.year, m: +o.month, d: +o.day,
      hh: +o.hour % 24, mm: +o.minute,
      dow: days[o.weekday],
      min: (+o.hour % 24) * 60 + (+o.minute)
    };
    if (Object.keys(partsCache).length > 400) partsCache = {};
    partsCache[key] = out;
    return out;
  }

  // Desplazamiento de una zona horaria en un instante dado, en milisegundos.
  function tzOffset(tz, ms) {
    var p = partsIn(tz, ms);
    var asUTC = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, 0);
    return asUTC - Math.floor(ms / 60000) * 60000;
  }

  // ---------- feriados ----------
  function easter(y) {
    // Algoritmo de Gauss/Meeus para el domingo de Pascua (calendario gregoriano).
    var a = y % 19, b = Math.floor(y / 100), c = y % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31);
    var da = ((h + l - 7 * m + 114) % 31) + 1;
    return { m: mo, d: da };
  }

  function addDays(y, m, d, n) {
    var t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  function nthWeekday(y, m, dow, n) {
    // n-ésimo día de la semana del mes (n negativo = el último).
    if (n > 0) {
      var first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      var day = 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
      return { y: y, m: m, d: day };
    }
    var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var lastDow = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
    return { y: y, m: m, d: lastDay - ((lastDow - dow + 7) % 7) };
  }

  var holidayCache = {};

  function holidaysFor(mkt, year) {
    var key = mkt + year;
    if (holidayCache[key]) return holidayCache[key];
    var set = {};
    function put(o) { set[o.m + '-' + o.d] = true; }
    var e = easter(year);

    if (mkt === 'us') {
      put({ m: 1, d: 1 });                       // Año nuevo
      put(nthWeekday(year, 1, 1, 3));            // Martin Luther King
      put(nthWeekday(year, 2, 1, 3));            // Día de los Presidentes
      put(addDays(year, e.m, e.d, -2));          // Viernes Santo
      put(nthWeekday(year, 5, 1, -1));           // Memorial Day
      put({ m: 6, d: 19 });                      // Juneteenth
      put({ m: 7, d: 4 });                       // Independencia
      put(nthWeekday(year, 9, 1, 1));            // Día del Trabajo
      put(nthWeekday(year, 11, 4, 4));           // Acción de Gracias
      put({ m: 12, d: 25 });                     // Navidad
    } else if (mkt === 'ar') {
      put({ m: 1, d: 1 });                       // Año nuevo
      put(addDays(year, e.m, e.d, -48));         // Carnaval (lunes)
      put(addDays(year, e.m, e.d, -47));         // Carnaval (martes)
      put({ m: 3, d: 24 });                      // Memoria por la Verdad y la Justicia
      put(addDays(year, e.m, e.d, -3));          // Jueves Santo
      put(addDays(year, e.m, e.d, -2));          // Viernes Santo
      put({ m: 4, d: 2 });                       // Malvinas
      put({ m: 5, d: 1 });                       // Día del Trabajador
      put({ m: 5, d: 25 });                      // Revolución de Mayo
      put({ m: 6, d: 20 });                      // Belgrano
      put({ m: 7, d: 9 });                       // Independencia
      put({ m: 8, d: 17 });                      // San Martín
      put({ m: 12, d: 8 });                      // Inmaculada Concepción
      put({ m: 12, d: 25 });                     // Navidad
    }
    holidayCache[key] = set;
    return set;
  }

  // ---------- estado ----------
  /* status(desc) → {
       open, state: 'open'|'closed'|'weekend'|'holiday'|'always',
       label, detail, nextMs, session
     } */
  function status(desc, now) {
    now = now || Date.now();
    var mkt = desc && desc.mkt ? desc.mkt : 'crypto';
    var s = SESSIONS[mkt] || SESSIONS.crypto;

    if (mkt === 'crypto') {
      return { open: true, state: 'always', label: 'Abierto', detail: s.label, nextMs: null, session: s };
    }

    var p = partsIn(s.tz, now);
    var isWeekend = s.days.indexOf(p.dow) < 0;
    var isHoliday = !!holidaysFor(mkt, p.y)[p.m + '-' + p.d];

    if (isWeekend || isHoliday) {
      return {
        open: false,
        state: isHoliday ? 'holiday' : 'weekend',
        label: 'Cerrado',
        detail: isHoliday ? 'Feriado' : 'Fin de semana',
        nextMs: msUntilNextOpen(mkt, s, now),
        session: s
      };
    }
    if (p.min < s.open) {
      return {
        open: false, state: 'closed', label: 'Cerrado',
        detail: 'Abre a las ' + hhmm(s.open),
        nextMs: (s.open - p.min) * 60000, session: s
      };
    }
    if (p.min >= s.close) {
      return {
        open: false, state: 'closed', label: 'Cerrado',
        detail: 'Cerró a las ' + hhmm(s.close),
        nextMs: msUntilNextOpen(mkt, s, now), session: s
      };
    }
    return {
      open: true, state: 'open', label: 'Abierto',
      detail: 'Cierra a las ' + hhmm(s.close),
      nextMs: (s.close - p.min) * 60000, session: s
    };
  }

  function msUntilNextOpen(mkt, s, now) {
    // Se avanza día a día hasta encontrar el próximo hábil.
    for (var i = 0; i <= 10; i++) {
      var t = now + i * 86400000;
      var p = partsIn(s.tz, t);
      if (s.days.indexOf(p.dow) < 0) continue;
      if (holidaysFor(mkt, p.y)[p.m + '-' + p.d]) continue;
      if (i === 0 && p.min >= s.open) continue;   // hoy ya pasó la apertura
      var mins = (i === 0 ? 0 : 0) + (s.open - p.min) + i * 0;
      // Diferencia real: se recalcula con el desplazamiento del día objetivo.
      var target = Date.UTC(p.y, p.m - 1, p.d, 0, 0) + s.open * 60000 - tzOffset(s.tz, t);
      if (target > now) return target - now;
      void mins;
    }
    return null;
  }

  function hhmm(min) {
    return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2);
  }

  function humanDuration(ms) {
    if (ms == null || !isFinite(ms) || ms < 0) return '';
    var m = Math.round(ms / 60000);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return h + ' h' + (r ? ' ' + r + ' min' : '');
    var d = Math.floor(h / 24);
    return d + (d === 1 ? ' día' : ' días') + (h % 24 ? ' ' + (h % 24) + ' h' : '');
  }

  TV.Market = {
    SESSIONS: SESSIONS,
    status: status,
    tzOffset: tzOffset,
    partsIn: partsIn,
    humanDuration: humanDuration
  };
})();
