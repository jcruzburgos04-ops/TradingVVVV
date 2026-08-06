# 📈 LibreCharts — Gráficos sin límites

Plataforma de gráficos financieros inspirada en TradingView, pero **sin ningún límite**:

- ♾️ **Indicadores ilimitados** — añade 1, 10 o 50 indicadores al mismo gráfico. Sin planes de pago, sin "máximo 2 indicadores".
- ♾️ **Dibujos ilimitados** — líneas de tendencia, rayos, fibonacci, rectángulos… todos los que quieras.
- ♾️ **Listas de seguimiento ilimitadas** — añade todos los símbolos que necesites.
- 🚫 **Sin cuenta, sin registro, sin anuncios.** Todo corre en tu navegador.

> Proyecto libre y educativo. No está afiliado a TradingView ni a Binance.

## ✨ Características

| | |
|---|---|
| **Tipos de gráfico** | Velas japonesas, Heikin Ashi, Barras OHLC, Línea, Área |
| **Temporalidades** | 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1D, 3D, 1S, 1M |
| **Datos en vivo** | API pública de Binance (REST + WebSocket), sin clave de API |
| **Modo sin conexión** | Si no hay red, genera un mercado sintético para seguir practicando |
| **Interacción** | Zoom con la rueda, paneo arrastrando, pellizco táctil, crosshair con OHLCV |
| **Historial infinito** | Carga velas antiguas automáticamente al desplazarte a la izquierda |
| **Extras** | Captura PNG del gráfico, pantalla completa, tema oscuro/claro, todo se guarda en `localStorage` |

### 📊 28 indicadores incluidos (todos configurables, todos ilimitados)

**Superposiciones:** SMA, EMA, WMA, HMA (Hull), DEMA, TEMA, VWAP, Bandas de Bollinger, Canales de Keltner, Canales de Donchian, Envolventes, SAR Parabólico, SuperTrend, Nube de Ichimoku.

**Osciladores (cada uno en su propio panel):** Volumen, RSI, MACD, Estocástico, RSI Estocástico, CCI, ATR, ADX (+DI/−DI), OBV, MFI, Williams %R, Momentum, ROC, TRIX, Oscilador Asombroso (AO), Oscilador Definitivo (UO), Flujo de Dinero de Chaikin (CMF).

Cuando los paneles de osciladores no caben en pantalla, el gráfico crece y aparece scroll vertical: puedes tener literalmente decenas de indicadores a la vez.

### ✏️ Herramientas de dibujo

Línea de tendencia · Rayo · Línea horizontal · Línea vertical · Rectángulo · Retroceso de Fibonacci. Selecciona con clic, mueve los extremos arrastrando, borra con `Supr`. Los dibujos se guardan por símbolo.

## 🚀 Cómo usarlo

No hay dependencias ni proceso de compilación. Tres opciones:

1. **Doble clic** en `index.html` (funciona directamente desde el disco).
2. **Servidor local** (recomendado):
   ```bash
   python3 -m http.server 8000
   # abre http://localhost:8000
   ```
3. **GitHub Pages**: en *Settings → Pages*, elige *Deploy from a branch* y selecciona esta rama con la carpeta raíz (`/`). Tendrás la plataforma en línea en `https://<usuario>.github.io/<repo>/`.

## ⌨️ Atajos de teclado

| Tecla | Acción |
|---|---|
| `S` | Buscar símbolo |
| `I` | Abrir indicadores |
| `+` / `−` | Acercar / alejar |
| `←` / `→` | Desplazar el gráfico |
| `Supr` | Borrar el dibujo seleccionado |
| `Esc` | Cancelar herramienta / cerrar ventanas |
| Doble clic | Reiniciar la vista |

## 🗂 Estructura del proyecto

```
index.html          Página principal
css/style.css       Tema oscuro/claro
js/indicators.js    Motor de cálculo de los 28 indicadores
js/data.js          Datos: Binance (REST + WebSocket) y modo demo
js/engine.js        Motor de render en canvas: velas, paneles, crosshair, dibujos
js/app.js           Interfaz: barra superior, modales, leyenda, lista de seguimiento
```

Todo es JavaScript puro (sin frameworks, sin CDN): funciona sin conexión y en cualquier navegador moderno.

## 🧭 Hoja de ruta

- Alertas de precio con notificaciones del navegador
- Diseños multi-gráfico (2×2, 1+3…)
- Más fuentes de datos (acciones, forex)
- Repetición de mercado (replay) para practicar

## ⚠️ Aviso

Este software es solo para fines educativos y de análisis. No constituye asesoramiento financiero. Los datos provienen de la API pública de Binance y pueden diferir de otras fuentes.
