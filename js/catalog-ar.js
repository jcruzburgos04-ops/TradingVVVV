/* LibreCharts — catálogo de activos con negociación en Argentina (BYMA / MAE).
 *
 * Este archivo trae el núcleo estable del mercado local: acciones de los paneles
 * líder y general, CEDEARs, bonos soberanos en dólares (Bonares y Globales),
 * BOPREAL, bonos CER y dollar-linked, e índices.
 *
 * Los instrumentos de vida corta —LECAP/BONCAP, obligaciones negociables,
 * bonos provinciales y nuevas emisiones— NO se escriben acá a mano: se
 * descubren en vivo desde la API pública de data912 al abrir la aplicación
 * (ver js/data.js → discoverArgentina). Así la lista refleja lo que realmente
 * cotiza hoy, sin tickers vencidos ni inventados. */
(function () {
  'use strict';
  window.TV = window.TV || {};
  TV.RawCatalog = TV.RawCatalog || [];

  // ---------- acciones: panel líder ----------
  var LIDER = `
ALUA|Aluar Aluminio Argentino
BBAR|Banco BBVA Argentina
BMA|Banco Macro
BYMA|Bolsas y Mercados Argentinos
CEPU|Central Puerto
COME|Sociedad Comercial del Plata
CRES|Cresud
CVH|Cablevisión Holding
EDN|Edenor
GGAL|Grupo Financiero Galicia
IRSA|IRSA Inversiones y Representaciones
LOMA|Loma Negra
METR|Metrogas
MIRG|Mirgor
PAMP|Pampa Energía
SUPV|Grupo Supervielle
TECO2|Telecom Argentina
TGNO4|Transportadora de Gas del Norte
TGSU2|Transportadora de Gas del Sur
TRAN|Transener
TXAR|Ternium Argentina
VALO|Grupo Financiero Valores
YPFD|YPF
`;

  // ---------- acciones: panel general ----------
  var GENERAL = `
AGRO|Agrometal
AUSO|Autopistas del Sol
BHIP|Banco Hipotecario
BOLT|Boldt
CADO|Carlos Casado
CAPX|Capex
CARC|Carboclor
CECO2|Central Costanera
CELU|Celulosa Argentina
CGPA2|Camuzzi Gas Pampeana
CTIO|Consultatio
DGCU2|Distribuidora de Gas Cuyana
DOME|Domec
DYCA|Dycasa
FERR|Ferrum
FIPL|Fiplasto
GAMI|Boldt Gaming
GARO|Garovaglio y Zorraquín
GBAN|Gas Natural Ban
GCLA|Grupo Clarín
GRIM|Grimoldi
HARG|Holcim Argentina
HAVA|Havanna
INTR|Introductora de Buenos Aires
INVJ|Inversora Juramento
LEDE|Ledesma
LONG|Longvie
MOLA|Molinos Agro
MOLI|Molinos Río de la Plata
MORI|Morixe Hermanos
OEST|Oeste Grupo Concesionario
PATA|Importadora y Exportadora de la Patagonia
POLL|Polledo
RIGO|Rigolleau
ROSE|Instituto Rosenbusch
SAMI|S.A. San Miguel
SEMI|Molinos Juan Semino
`;

  // ---------- CEDEARs ----------
  var CEDEAR = `
AAPL|Apple
MSFT|Microsoft
AMZN|Amazon
GOOGL|Alphabet
META|Meta Platforms
NVDA|NVIDIA
TSLA|Tesla
NFLX|Netflix
DISN|Walt Disney
KO|Coca-Cola
PEP|PepsiCo
MCD|McDonald's
SBUX|Starbucks
NKE|Nike
WMT|Walmart
HD|Home Depot
LOW|Lowe's
TGT|Target
COST|Costco Wholesale
JNJ|Johnson & Johnson
PFE|Pfizer
MRK|Merck
LLY|Eli Lilly
ABBV|AbbVie
BMY|Bristol-Myers Squibb
AMGN|Amgen
GILD|Gilead Sciences
UNH|UnitedHealth
MDT|Medtronic
ABT|Abbott Laboratories
XOM|Exxon Mobil
CVX|Chevron
COP|ConocoPhillips
OXY|Occidental Petroleum
SLB|SLB (Schlumberger)
HAL|Halliburton
PSX|Phillips 66
VLO|Valero Energy
KMI|Kinder Morgan
EOG|EOG Resources
DVN|Devon Energy
APA|APA Corporation
JPM|JPMorgan Chase
BAC|Bank of America
C|Citigroup
GS|Goldman Sachs
MS|Morgan Stanley
WFC|Wells Fargo
BRKB|Berkshire Hathaway (Clase B)
V|Visa
MA|Mastercard
AXP|American Express
PYPL|PayPal
SCHW|Charles Schwab
BLK|BlackRock
INTC|Intel
AMD|Advanced Micro Devices
QCOM|Qualcomm
TXN|Texas Instruments
MU|Micron Technology
AMAT|Applied Materials
ADBE|Adobe
CRM|Salesforce
ORCL|Oracle
IBM|IBM
CSCO|Cisco Systems
HPQ|HP Inc.
DELL|Dell Technologies
ERIC|Ericsson
NOKA|Nokia
TSM|Taiwan Semiconductor
ASML|ASML Holding
SAP|SAP SE
SONY|Sony Group
TM|Toyota Motor
HMC|Honda Motor
BA|Boeing
CAT|Caterpillar
DE|Deere & Company
GE|GE Aerospace
HON|Honeywell
MMM|3M
LMT|Lockheed Martin
RTX|RTX Corporation
UPS|United Parcel Service
FDX|FedEx
UNP|Union Pacific
T|AT&T
VZ|Verizon
TMUS|T-Mobile US
CMCSA|Comcast
F|Ford Motor
GM|General Motors
X|United States Steel
AA|Alcoa
FCX|Freeport-McMoRan
NEM|Newmont
GOLD|Barrick Mining
VALE|Vale
PBR|Petrobras
ITUB|Itaú Unibanco
BBD|Banco Bradesco
ABEV|Ambev
BABA|Alibaba Group
JD|JD.com
BIDU|Baidu
NIO|NIO Inc.
XPEV|XPeng
LI|Li Auto
PDD|PDD Holdings
MELI|MercadoLibre
GLOB|Globant
VIST|Vista Energy
DESP|Despegar
BIOX|Bioceres Crop Solutions
UBER|Uber Technologies
LYFT|Lyft
ABNB|Airbnb
SHOP|Shopify
SQ|Block
SPOT|Spotify
ZM|Zoom Communications
DOCU|DocuSign
SNAP|Snap Inc.
PINS|Pinterest
RBLX|Roblox
PLTR|Palantir Technologies
COIN|Coinbase
MSTR|MicroStrategy
MARA|Marathon Digital
RIOT|Riot Platforms
EBAY|eBay
ETSY|Etsy
BKNG|Booking Holdings
MAR|Marriott International
RCL|Royal Caribbean
CCL|Carnival
LVS|Las Vegas Sands
WYNN|Wynn Resorts
MGM|MGM Resorts
YUM|Yum! Brands
CMG|Chipotle Mexican Grill
DPZ|Domino's Pizza
PG|Procter & Gamble
CL|Colgate-Palmolive
KMB|Kimberly-Clark
MDLZ|Mondelez International
GIS|General Mills
KHC|Kraft Heinz
MO|Altria Group
PM|Philip Morris International
STZ|Constellation Brands
LIN|Linde
DOW|Dow Inc.
DD|DuPont de Nemours
PPG|PPG Industries
SHW|Sherwin-Williams
ECL|Ecolab
NUE|Nucor
AMT|American Tower
PLD|Prologis
SPG|Simon Property Group
O|Realty Income
NEE|NextEra Energy
DUK|Duke Energy
SO|Southern Company
AEP|American Electric Power
EXC|Exelon
SPY|SPDR S&P 500 ETF
QQQ|Invesco Nasdaq-100 ETF
DIA|SPDR Dow Jones ETF
IWM|iShares Russell 2000 ETF
EEM|iShares MSCI Emerging Markets ETF
EWZ|iShares MSCI Brazil ETF
XLE|Energy Select Sector SPDR
XLF|Financial Select Sector SPDR
ARKK|ARK Innovation ETF
`;

  // ---------- bonos soberanos en dólares: ley argentina (Bonares) ----------
  var BONAR = `
AL29|Bonar 2029 (ley argentina)
AL30|Bonar 2030 (ley argentina)
AL35|Bonar 2035 (ley argentina)
AE38|Bonar 2038 (ley argentina)
AL41|Bonar 2041 (ley argentina)
`;

  // ---------- bonos soberanos en dólares: ley Nueva York (Globales) ----------
  var GLOBAL = `
GD29|Global 2029 (ley Nueva York)
GD30|Global 2030 (ley Nueva York)
GD35|Global 2035 (ley Nueva York)
GD38|Global 2038 (ley Nueva York)
GD41|Global 2041 (ley Nueva York)
GD46|Global 2046 (ley Nueva York)
`;

  // ---------- BOPREAL (Banco Central) ----------
  var BOPREAL = `
BPOA7|BOPREAL Serie 1 - Strip A
BPOB7|BOPREAL Serie 1 - Strip B
BPOC7|BOPREAL Serie 1 - Strip C
BPOD7|BOPREAL Serie 1 - Strip D
BPJ25|BOPREAL Serie 2
BPY26|BOPREAL Serie 3
`;

  // ---------- bonos ajustados por CER ----------
  var CER = `
TX26|Boncer TX26
TX28|Boncer TX28
TZX25|Boncer cero cupón TZX25
TZX26|Boncer cero cupón TZX26
TZX27|Boncer cero cupón TZX27
TZX28|Boncer cero cupón TZX28
TZXD5|Boncer cero cupón TZXD5
TZXD6|Boncer cero cupón TZXD6
TZXD7|Boncer cero cupón TZXD7
DICP|Discount en pesos (CER)
PARP|Par en pesos (CER)
CUAP|Cuasipar en pesos (CER)
PR13|Bono consolidación 8ª serie (PR13)
PR17|Bono consolidación (PR17)
`;

  // ---------- bonos dollar-linked ----------
  var DLK = `
TV25|Bono dollar-linked TV25
TV26|Bono dollar-linked TV26
TZV25|Bono dollar-linked TZV25
TZVD5|Bono dollar-linked TZVD5
TZVD6|Bono dollar-linked TZVD6
`;

  // ---------- índices locales ----------
  var INDICES = `
^MERV|S&P MERVAL
`;

  function push(blob, type, opts) {
    opts = opts || {};
    blob.trim().split('\n').forEach(function (line) {
      var p = line.split('|');
      var s = (p[0] || '').trim();
      if (!s) return;
      var it = {
        s: s,
        n: (p[1] || s).trim(),
        mkt: 'ar',
        type: type,
        ccy: opts.ccy || 'ARS',
        yh: s.charAt(0) === '^' ? s : s + '.BA'
      };
      TV.RawCatalog.push(it);

      // Los bonos cotizan además en dólar MEP (sufijo D) y cable (sufijo C).
      if (opts.species) {
        TV.RawCatalog.push({
          s: s + 'D', n: it.n + ' — en dólar MEP', mkt: 'ar', type: type,
          ccy: 'USD', yh: s + 'D.BA'
        });
        TV.RawCatalog.push({
          s: s + 'C', n: it.n + ' — en dólar cable', mkt: 'ar', type: type,
          ccy: 'USD', yh: s + 'C.BA'
        });
      }
    });
  }

  push(LIDER, 'stock');
  push(GENERAL, 'stock');
  push(CEDEAR, 'cedear');
  push(BONAR, 'bond', { species: true });
  push(GLOBAL, 'bond', { species: true });
  push(BOPREAL, 'bopreal', { species: true });
  push(CER, 'cer');
  push(DLK, 'dlk');
  push(INDICES, 'index');

  // ---------- dólares financieros (series derivadas) ----------
  // El MEP y el CCL no son un instrumento con su propia serie: son el cociente
  // entre el precio en pesos y el precio en dólares del mismo bono. Se calculan
  // vela a vela a partir de las dos series subyacentes.
  TV.RawCatalog.push(
    { s: 'MEP', n: 'Dólar MEP (AL30 / AL30D)', mkt: 'ar', type: 'fx', ccy: 'ARS', derived: { num: 'AL30', den: 'AL30D' } },
    { s: 'CCL', n: 'Dólar cable / CCL (AL30 / AL30C)', mkt: 'ar', type: 'fx', ccy: 'ARS', derived: { num: 'AL30', den: 'AL30C' } },
    { s: 'MEP-GD30', n: 'Dólar MEP con GD30', mkt: 'ar', type: 'fx', ccy: 'ARS', derived: { num: 'GD30', den: 'GD30D' } }
  );
})();
