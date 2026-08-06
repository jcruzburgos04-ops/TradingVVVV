# 📈 LibreCharts — Gráficos sin límites

Plataforma de gráficos financieros inspirada en TradingView, pero **sin ningún límite**:

- ♾️ **Indicadores ilimitados** — añadí 1, 10 o 50 indicadores al mismo gráfico. Sin planes de pago, sin "máximo 2 indicadores".
- ♾️ **Dibujos ilimitados** — líneas de tendencia, rayos, Fibonacci, rectángulos… todos los que quieras.
- ♾️ **Listas de seguimiento ilimitadas**, mezclando acciones argentinas, bonos, CEDEARs, papeles de Wall Street y cripto.
- 🚫 **Sin cuenta, sin registro, sin anuncios.** Todo corre en tu navegador.

> Proyecto libre y educativo. No está afiliado a TradingView, BYMA, Binance ni Yahoo Finance.

## 🌎 Mercados incluidos

El catálogo trae **1.006 activos** listos para buscar, y se amplía solo (ver abajo).

### 🇦🇷 Argentina (BYMA) — 310 activos

| Categoría | Contenido |
|---|---|
| **Acciones** | Panel líder completo (GGAL, YPFD, PAMP, ALUA, TXAR, BMA, TECO2, TGSU2, LOMA, MIRG…) y panel general (LEDE, MOLI, SAMI, CELU, AGRO, CAPX, HARG…) |
| **CEDEARs** | ~180 certificados: AAPL, MSFT, TSLA, NVDA, MELI, KO, BABA, VALE, PBR, más CEDEARs de ETF (SPY, QQQ, DIA, EWZ, ARKK) |
| **Bonos soberanos** | Bonares ley argentina (AL29, AL30, AL35, AE38, AL41) y Globales ley Nueva York (GD29, GD30, GD35, GD38, GD41, GD46) |
| **Especies en dólares** | Cada bono también en dólar MEP (sufijo `D`) y cable (sufijo `C`): AL30D, AL30C, GD30D, GD30C… |
| **BOPREAL** | Serie 1 (strips A, B, C, D), Serie 2 y Serie 3 |
| **Bonos CER** | TX26, TX28, TZX25–TZX28, TZXD5–TZXD7, DICP, PARP, CUAP, PR13, PR17 |
| **Dollar-linked** | TV25, TV26, TZV25, TZVD5, TZVD6 |
| **Dólares financieros** | MEP y CCL calculados vela a vela como cociente de las dos puntas del bono (AL30/AL30D y AL30/AL30C) |
| **Letras y ONs** | Se descubren en vivo (ver más abajo) |

### 🇺🇸 Estados Unidos — 648 activos

Acciones del S&P 500 y principales cotizantes de NYSE y Nasdaq organizados por sector, 64 ETF (SPY, QQQ, IWM, TLT, GLD, los once sectoriales SPDR, ARGT…), 15 índices (^GSPC, ^DJI, ^IXIC, ^MERV, ^VIX) y los 20 ADR argentinos que cotizan en Nueva York (YPF, PAM, GGAL, BMA, TEO, CRESY, MELI, GLOB, VIST, CAAP…). También divisas y futuros: dólar/peso, oro, petróleo, soja, maíz.

**¿Querés absolutamente todas las acciones listadas?** Un comando importa el universo completo (~8.000 símbolos de Nasdaq, NYSE, NYSE American, NYSE ARCA, Cboe BZX e IEX) desde los listados oficiales de NASDAQ Trader:

```bash
node tools/build-catalog.mjs
```

Genera `js/catalog-us-full.js` y engancha el script en `index.html` automáticamente. Volvé a correrlo cada tanto para incorporar altas y bajas. Si tu red bloquea el sitio, bajá `nasdaqlisted.txt` y `otherlisted.txt` a mano y usá `--dir ./carpeta`.

### ₿ Cripto — 48 pares

Los pares principales de Binance en USDT y BTC, con velas y precios por WebSocket.

### 🔎 Descubrimiento en vivo del mercado argentino

Las letras (LECAP/BONCAP), las obligaciones negociables y las emisiones nuevas **no están escritas a mano** en el código: al abrir la aplicación se consultan los paneles públicos de **data912** y se incorpora al catálogo todo lo que realmente cotiza hoy en BYMA. Así la lista nunca queda con tickers vencidos ni inventados. También podés forzarlo desde **Fuentes de datos → Actualizar**.

## 🔌 De dónde salen los datos

| Activo | Fuente | Cómo |
|---|---|---|
| Cripto | **Binance** | REST para el histórico + WebSocket en vivo |
| Acciones, ETF, bonos, índices, divisas | **Yahoo Finance** | Histórico OHLC; los papeles de BYMA con sufijo `.BA` (`GGAL.BA`, `AL30.BA`) |
| Respaldo diario EE.UU. | **Stooq** | CSV, si Yahoo no responde |
| Precios en vivo de BYMA | **data912** | Panel público de BYMA, refrescado cada 12–15 s |
| Sin red | **Mercado sintético** | La aplicación sigue funcionando con datos simulados |

Todas son públicas y **sin clave de API**. Si tu navegador bloquea alguna por CORS, en **Fuentes de datos** podés configurar tu propio proxy (con `{url}` como marcador). La barra inferior siempre dice qué fuente está sirviendo el gráfico.

Yahoo no publica velas de 2h, 4h, 6h, 8h o 12h: esas temporalidades se arman agrupando velas de 60 minutos del lado del cliente.

## ✨ Resto de características

| | |
|---|---|
| **Tipos de gráfico** | Velas japonesas, Heikin Ashi, barras OHLC, línea, área |
| **Temporalidades** | 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1D, 3D, 1S, 1M |
| **Interacción** | Zoom con la rueda, paneo arrastrando, pellizco táctil, crosshair con OHLCV |
| **Historial infinito** | En cripto carga velas antiguas al desplazarte a la izquierda |
| **Extras** | Captura PNG, pantalla completa, tema oscuro/claro, todo guardado en `localStorage` |

### 📊 28 indicadores (todos configurables, todos ilimitados)

**Superposiciones:** SMA, EMA, WMA, HMA (Hull), DEMA, TEMA, VWAP, Bandas de Bollinger, Canales de Keltner, Canales de Donchian, Envolventes, SAR Parabólico, SuperTrend, Nube de Ichimoku.

**Osciladores (cada uno en su panel):** Volumen, RSI, MACD, Estocástico, RSI Estocástico, CCI, ATR, ADX (+DI/−DI), OBV, MFI, Williams %R, Momentum, ROC, TRIX, Oscilador Asombroso (AO), Oscilador Definitivo (UO), Flujo de Dinero de Chaikin (CMF).

Cuando los paneles no entran en pantalla, el gráfico crece y aparece scroll vertical: podés tener decenas de indicadores a la vez.

### ✏️ Herramientas de dibujo

Línea de tendencia · Rayo · Línea horizontal · Línea vertical · Rectángulo · Retroceso de Fibonacci. Seleccioná con clic, mové los extremos arrastrando, borrá con `Supr`. Se guardan por activo.

## 🚀 Cómo usarlo

Sin dependencias ni compilación:

1. **Doble clic** en `index.html`.
2. **Servidor local** (recomendado): `python3 -m http.server 8000` y abrí `http://localhost:8000`.
3. **GitHub Pages**: en *Settings → Pages*, elegí *Deploy from a branch*, esta rama y la carpeta raíz (`/`).

## ⌨️ Atajos de teclado

| Tecla | Acción |
|---|---|
| `S` | Buscar activo |
| `I` | Abrir indicadores |
| `+` / `−` | Acercar / alejar |
| `←` / `→` | Desplazar el gráfico |
| `Supr` | Borrar el dibujo seleccionado |
| `Esc` | Cancelar herramienta / cerrar ventanas |
| Doble clic | Reiniciar la vista |

## 🗂 Estructura del proyecto

```
index.html             Página principal
css/style.css          Tema oscuro/claro
js/catalog-crypto.js   Pares de Binance
js/catalog-us.js       S&P 500, NYSE/Nasdaq, ETF, índices, ADR argentinos
js/catalog-ar.js       BYMA: acciones, CEDEARs, bonos, BOPREAL, CER, MEP/CCL
js/catalog.js          Índice, búsqueda y resolución de símbolos
js/indicators.js       Cálculo de los 28 indicadores
js/data.js             Fuentes de datos y enrutado por mercado
js/engine.js           Render en canvas: velas, paneles, crosshair, dibujos
js/app.js              Interfaz: barra, modales, leyenda, lista de seguimiento
tools/build-catalog.mjs  Importa el universo completo de acciones de EE.UU.
```

Todo es JavaScript puro (sin frameworks ni CDN): funciona en cualquier navegador moderno.

## 🧭 Hoja de ruta

- Alertas de precio con notificaciones del navegador
- Paridad y TIR de los bonos calculadas en el gráfico
- Diseños multi-gráfico (2×2, 1+3…)
- Repetición de mercado (replay) para practicar

## ⚠️ Aviso

Software educativo y de análisis. No constituye asesoramiento financiero. Los datos provienen de fuentes públicas de terceros, pueden tener demoras y diferir de los precios oficiales de BYMA o de tu bróker. Verificá siempre antes de operar.
