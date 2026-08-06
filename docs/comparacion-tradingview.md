# Comparación con TradingView

Inventario de lo que ofrece TradingView en su vista de gráfico y estado en LibreCharts.
Sirve como hoja de ruta: se actualiza a medida que se implementa.

Leyenda: ✅ hecho · 🟡 parcial · ⬜ pendiente · ❌ descartado (requiere servidor propio o licencias)

## 1. Barra superior

| Función | Estado | Nota |
|---|---|---|
| Buscador de activos con ícono y descripción | ✅ | Filtros por mercado y tipo |
| Favoritos y recientes en el buscador | ✅ | Se guardan en el navegador |
| Temporalidades rápidas + menú de más | ✅ | De 1m a trimestral |
| Temporalidad personalizada | ⬜ | |
| Tipos de gráfico | 🟡 | Velas, Heikin Ashi, barras, línea, área. Faltan Renko, Kagi, Point&Figure, Line Break |
| Indicadores (buscador, favoritos) | ✅ | 28, sin límite de cantidad |
| Plantillas de indicadores | ✅ | Guardar y aplicar conjuntos |
| Alertas | ✅ | Cruce de precio, con notificación del navegador |
| Reproducción de barras (replay) | ✅ | Reproducir, pausar, paso a paso, velocidad |
| Deshacer / rehacer | ✅ | También con Ctrl+Z / Ctrl+Y |
| Diseños multi-gráfico (2×2, 1+3…) | ⬜ | |
| Guardar / cargar diseños con nombre | 🟡 | Se guarda el último estado automáticamente |
| Captura de pantalla | ✅ | Descarga PNG |
| Publicar idea | ❌ | Es una red social, necesita servidor |
| Panel de operaciones con bróker | ❌ | Requiere integración con bróker |

## 2. Herramientas de dibujo

| Función | Estado |
|---|---|
| Cursor, línea de tendencia, rayo, línea extendida | ✅ |
| Líneas horizontal y vertical, rayo horizontal | ✅ |
| Canal paralelo | ✅ |
| Rectángulo, elipse, flecha, texto | ✅ |
| Retroceso de Fibonacci | ✅ |
| Extensión de Fibonacci, abanico, arcos, espiral | ⬜ |
| Regla / medición | ✅ |
| Rango de precio y rango de fecha | 🟡 | La regla cubre ambos |
| Posición larga / corta | ✅ |
| Ondas de Elliott, patrones XABCD, cabeza y hombros | ⬜ |
| Pincel a mano alzada, notas, emojis | ⬜ |
| Imán (desactivado / débil / fuerte) | ✅ |
| Modo de dibujo continuo | ✅ |
| Bloquear, ocultar y quitar todos los dibujos | ✅ |
| Árbol de objetos (lista de dibujos) | ✅ |
| Estilo por dibujo: color, grosor, trazo | ✅ |
| Clonar dibujo | ✅ |

## 3. Gráfico e interacción

| Función | Estado |
|---|---|
| Zoom con rueda, paneo, pellizco táctil | ✅ |
| Crosshair con etiquetas en ambos ejes | ✅ |
| Escala logarítmica | ✅ |
| Escala en porcentaje | ✅ |
| Auto-escala y bloqueo de escala | ✅ |
| Invertir escala | ✅ |
| Cuenta regresiva al cierre de la vela | ✅ |
| Ajustar altura de paneles arrastrando | ✅ |
| Ajustar ancho del panel lateral arrastrando | ✅ |
| Menú contextual con clic derecho | ✅ |
| Zona horaria configurable | ✅ |
| Sesión extendida (pre y post mercado) | ⬜ |
| Estado del mercado (abierto / cerrado) | ✅ |
| Comparar varios símbolos en el mismo gráfico | ⬜ |
| Perfil de volumen | ⬜ |
| Marcas de dividendos, splits y resultados | ⬜ |
| Escalas de precio múltiples | ⬜ |

## 4. Paneles laterales

| Función | Estado |
|---|---|
| Lista de seguimiento con logo, última y variación | ✅ |
| Agrupar y plegar por sección | ✅ |
| Varias listas con nombre | ⬜ |
| Ventana de datos | ✅ |
| Panel de alertas | ✅ |
| Árbol de objetos | ✅ |
| Detalles del símbolo | 🟡 | Mercado, tipo y moneda en la leyenda |
| Calendario económico, noticias, ideas, chat | ❌ | Requiere servidor y contenido propio |

## 5. Ajustes del gráfico

| Función | Estado |
|---|---|
| Colores de velas y mechas | ✅ |
| Grilla, fondo y marca de agua | ✅ |
| Mostrar/ocultar última cotización y línea de precio | ✅ |
| Precisión decimal | ✅ |
| Zona horaria y formato de hora | ✅ |
| Tema claro y oscuro | ✅ |
| Escala: modo, margen | 🟡 | Modo sí, márgenes no |

## 6. Datos

| Función | Estado |
|---|---|
| Cripto en vivo | ✅ | Bybit (perpetuo y spot), respaldo Binance |
| Acciones, bonos, ETF, índices | ✅ | Yahoo Finance; BYMA con sufijo `.BA` |
| Precios en vivo de BYMA | ✅ | data912 |
| Horario de mercado y estado | ✅ | Cripto 24/7, BYMA 11–17, EE.UU. 9:30–16 |
| Datos simulados | ✅ | Sólo si se activan a mano, nunca automáticos |

## Criterio sobre los datos simulados

TradingView nunca inventa precios. LibreCharts tampoco: si una fuente no responde,
se muestra el error y se ofrece reintentar. Si el mercado está cerrado, el gráfico
queda quieto con la última vela real y el estado dice **CERRADO** con la hora de
apertura. El generador sintético existe sólo para probar la interfaz sin conexión
y hay que encenderlo a mano en *Fuentes de datos*; mientras está encendido, un
cartel permanente lo recuerda.
