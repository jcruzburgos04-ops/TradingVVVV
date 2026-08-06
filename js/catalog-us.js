/* LibreCharts — catálogo de activos de EE.UU.
 * Acciones del S&P 500 y principales cotizantes de NYSE / Nasdaq, ETF, índices
 * y divisas. Formato compacto "TICKER|Nombre" para mantener el archivo liviano.
 *
 * Para importar el universo COMPLETO de NYSE/Nasdaq/NYSE American/ARCA
 * (~8.000 símbolos) ejecutá: node tools/build-catalog.mjs
 * Descarga los archivos oficiales de NASDAQ Trader y regenera este catálogo. */
(function () {
  'use strict';
  window.TV = window.TV || {};
  TV.RawCatalog = TV.RawCatalog || [];

  // ---------- acciones: tecnología y semiconductores ----------
  var TECH = `
AAPL|Apple
MSFT|Microsoft
NVDA|NVIDIA
AVGO|Broadcom
ORCL|Oracle
CRM|Salesforce
AMD|Advanced Micro Devices
ADBE|Adobe
ACN|Accenture
CSCO|Cisco Systems
INTC|Intel
INTU|Intuit
IBM|IBM
QCOM|Qualcomm
TXN|Texas Instruments
NOW|ServiceNow
AMAT|Applied Materials
MU|Micron Technology
ADI|Analog Devices
LRCX|Lam Research
KLAC|KLA Corporation
SNPS|Synopsys
CDNS|Cadence Design Systems
ANET|Arista Networks
PANW|Palo Alto Networks
CRWD|CrowdStrike
FTNT|Fortinet
ROP|Roper Technologies
APH|Amphenol
MSI|Motorola Solutions
GLW|Corning
HPQ|HP Inc.
HPE|Hewlett Packard Enterprise
DELL|Dell Technologies
NTAP|NetApp
WDC|Western Digital
STX|Seagate Technology
TER|Teradyne
MCHP|Microchip Technology
ON|ON Semiconductor
NXPI|NXP Semiconductors
SWKS|Skyworks Solutions
QRVO|Qorvo
MPWR|Monolithic Power Systems
TYL|Tyler Technologies
PTC|PTC Inc.
ANSS|Ansys
ADSK|Autodesk
IT|Gartner
CTSH|Cognizant
EPAM|EPAM Systems
GEN|Gen Digital
AKAM|Akamai Technologies
JNPR|Juniper Networks
FFIV|F5 Inc.
ZBRA|Zebra Technologies
KEYS|Keysight Technologies
TDY|Teledyne Technologies
TRMB|Trimble
VRSN|VeriSign
GDDY|GoDaddy
CDW|CDW Corporation
JBL|Jabil
SMCI|Super Micro Computer
PLTR|Palantir Technologies
WDAY|Workday
DDOG|Datadog
TEAM|Atlassian
APP|AppLovin
COIN|Coinbase
SNOW|Snowflake
NET|Cloudflare
ZS|Zscaler
OKTA|Okta
MDB|MongoDB
HUBS|HubSpot
TWLO|Twilio
DOCU|DocuSign
ZM|Zoom Communications
SQ|Block
SHOP|Shopify
UBER|Uber Technologies
LYFT|Lyft
RBLX|Roblox
U|Unity Software
PATH|UiPath
AI|C3.ai
ARM|Arm Holdings
ASML|ASML Holding
TSM|Taiwan Semiconductor
SONY|Sony Group
SAP|SAP SE
INFY|Infosys
WIT|Wipro
STM|STMicroelectronics
`;

  // ---------- comunicaciones y medios ----------
  var COMM = `
GOOGL|Alphabet (Clase A)
GOOG|Alphabet (Clase C)
META|Meta Platforms
NFLX|Netflix
DIS|Walt Disney
CMCSA|Comcast
VZ|Verizon
T|AT&T
TMUS|T-Mobile US
CHTR|Charter Communications
EA|Electronic Arts
TTWO|Take-Two Interactive
WBD|Warner Bros. Discovery
OMC|Omnicom Group
IPG|Interpublic Group
LYV|Live Nation
MTCH|Match Group
PARA|Paramount
FOXA|Fox (Clase A)
FOX|Fox (Clase B)
NWSA|News Corp (Clase A)
NWS|News Corp (Clase B)
PINS|Pinterest
SNAP|Snap Inc.
SPOT|Spotify
RDDT|Reddit
`;

  // ---------- consumo discrecional ----------
  var DISC = `
AMZN|Amazon
TSLA|Tesla
HD|Home Depot
MCD|McDonald's
NKE|Nike
LOW|Lowe's
SBUX|Starbucks
TJX|TJX Companies
BKNG|Booking Holdings
ABNB|Airbnb
CMG|Chipotle Mexican Grill
ORLY|O'Reilly Automotive
AZO|AutoZone
MAR|Marriott International
HLT|Hilton Worldwide
GM|General Motors
F|Ford Motor
RCL|Royal Caribbean
CCL|Carnival
NCLH|Norwegian Cruise Line
LVS|Las Vegas Sands
WYNN|Wynn Resorts
MGM|MGM Resorts
CZR|Caesars Entertainment
DHI|D.R. Horton
LEN|Lennar
PHM|PulteGroup
NVR|NVR Inc.
BLDR|Builders FirstSource
POOL|Pool Corporation
YUM|Yum! Brands
DRI|Darden Restaurants
DPZ|Domino's Pizza
ROST|Ross Stores
ULTA|Ulta Beauty
BBY|Best Buy
TSCO|Tractor Supply
GPC|Genuine Parts
LKQ|LKQ Corporation
APTV|Aptiv
BWA|BorgWarner
LULU|Lululemon Athletica
DECK|Deckers Outdoor
RL|Ralph Lauren
PVH|PVH Corp.
TPR|Tapestry
HAS|Hasbro
GRMN|Garmin
WSM|Williams-Sonoma
EBAY|eBay
ETSY|Etsy
EXPE|Expedia Group
KMX|CarMax
DASH|DoorDash
RIVN|Rivian Automotive
LCID|Lucid Group
NIO|NIO Inc.
LI|Li Auto
XPEV|XPeng
BABA|Alibaba Group
PDD|PDD Holdings
JD|JD.com
`;

  // ---------- consumo básico ----------
  var STAPLES = `
PG|Procter & Gamble
KO|Coca-Cola
PEP|PepsiCo
COST|Costco Wholesale
WMT|Walmart
PM|Philip Morris International
MO|Altria Group
MDLZ|Mondelez International
CL|Colgate-Palmolive
KMB|Kimberly-Clark
GIS|General Mills
KHC|Kraft Heinz
HSY|Hershey
STZ|Constellation Brands
KDP|Keurig Dr Pepper
MNST|Monster Beverage
SYY|Sysco
KR|Kroger
ADM|Archer-Daniels-Midland
TSN|Tyson Foods
CAG|Conagra Brands
CPB|Campbell's
SJM|J.M. Smucker
HRL|Hormel Foods
MKC|McCormick
CHD|Church & Dwight
CLX|Clorox
EL|Estée Lauder
K|Kellanova
LW|Lamb Weston
BG|Bunge Global
DG|Dollar General
DLTR|Dollar Tree
TGT|Target
`;

  // ---------- salud ----------
  var HEALTH = `
LLY|Eli Lilly
UNH|UnitedHealth Group
JNJ|Johnson & Johnson
ABBV|AbbVie
MRK|Merck & Co.
TMO|Thermo Fisher Scientific
ABT|Abbott Laboratories
DHR|Danaher
PFE|Pfizer
AMGN|Amgen
BMY|Bristol-Myers Squibb
GILD|Gilead Sciences
VRTX|Vertex Pharmaceuticals
ISRG|Intuitive Surgical
SYK|Stryker
BSX|Boston Scientific
MDT|Medtronic
CI|Cigna Group
ELV|Elevance Health
CVS|CVS Health
HUM|Humana
CNC|Centene
MCK|McKesson
COR|Cencora
CAH|Cardinal Health
ZTS|Zoetis
REGN|Regeneron Pharmaceuticals
MRNA|Moderna
BIIB|Biogen
IQV|IQVIA Holdings
A|Agilent Technologies
WAT|Waters Corporation
MTD|Mettler-Toledo
RMD|ResMed
DXCM|DexCom
IDXX|IDEXX Laboratories
WST|West Pharmaceutical
STE|Steris
BDX|Becton Dickinson
BAX|Baxter International
HOLX|Hologic
ZBH|Zimmer Biomet
EW|Edwards Lifesciences
PODD|Insulet
ALGN|Align Technology
INCY|Incyte
CRL|Charles River Laboratories
LH|Labcorp
DGX|Quest Diagnostics
UHS|Universal Health Services
HCA|HCA Healthcare
MOH|Molina Healthcare
VTRS|Viatris
GEHC|GE HealthCare
RVTY|Revvity
NVO|Novo Nordisk
AZN|AstraZeneca
GSK|GSK plc
SNY|Sanofi
`;

  // ---------- financieras ----------
  var FIN = `
BRK-B|Berkshire Hathaway (Clase B)
JPM|JPMorgan Chase
V|Visa
MA|Mastercard
BAC|Bank of America
WFC|Wells Fargo
GS|Goldman Sachs
MS|Morgan Stanley
AXP|American Express
SPGI|S&P Global
BLK|BlackRock
C|Citigroup
SCHW|Charles Schwab
CB|Chubb
PGR|Progressive
MMC|Marsh & McLennan
AON|Aon plc
ICE|Intercontinental Exchange
CME|CME Group
COF|Capital One Financial
PNC|PNC Financial Services
USB|U.S. Bancorp
TFC|Truist Financial
BK|Bank of New York Mellon
STT|State Street
NTRS|Northern Trust
FITB|Fifth Third Bancorp
HBAN|Huntington Bancshares
RF|Regions Financial
CFG|Citizens Financial Group
KEY|KeyCorp
MTB|M&T Bank
ZION|Zions Bancorporation
CMA|Comerica
AIG|American International Group
MET|MetLife
PRU|Prudential Financial
AFL|Aflac
ALL|Allstate
TRV|Travelers
HIG|Hartford Financial
CINF|Cincinnati Financial
WRB|W.R. Berkley
GL|Globe Life
AIZ|Assurant
ERIE|Erie Indemnity
BRO|Brown & Brown
AJG|Arthur J. Gallagher
MCO|Moody's
MSCI|MSCI Inc.
NDAQ|Nasdaq Inc.
CBOE|Cboe Global Markets
FDS|FactSet Research
TROW|T. Rowe Price
BEN|Franklin Resources
IVZ|Invesco
AMP|Ameriprise Financial
RJF|Raymond James Financial
SYF|Synchrony Financial
DFS|Discover Financial
FI|Fiserv
FIS|Fidelity National Information
GPN|Global Payments
PYPL|PayPal Holdings
JKHY|Jack Henry & Associates
HOOD|Robinhood Markets
SOFI|SoFi Technologies
`;

  // ---------- industriales y transporte ----------
  var IND = `
GE|GE Aerospace
CAT|Caterpillar
RTX|RTX Corporation
HON|Honeywell
UNP|Union Pacific
BA|Boeing
LMT|Lockheed Martin
DE|Deere & Company
UPS|United Parcel Service
ADP|Automatic Data Processing
ETN|Eaton Corporation
ITW|Illinois Tool Works
EMR|Emerson Electric
NOC|Northrop Grumman
GD|General Dynamics
CSX|CSX Corporation
NSC|Norfolk Southern
FDX|FedEx
WM|Waste Management
RSG|Republic Services
PH|Parker Hannifin
CMI|Cummins
PCAR|PACCAR
ROK|Rockwell Automation
AME|Ametek
DOV|Dover Corporation
IR|Ingersoll Rand
XYL|Xylem
FTV|Fortive
OTIS|Otis Worldwide
CARR|Carrier Global
JCI|Johnson Controls
TT|Trane Technologies
LHX|L3Harris Technologies
TDG|TransDigm Group
HWM|Howmet Aerospace
HEI|HEICO
AXON|Axon Enterprise
URI|United Rentals
FAST|Fastenal
GWW|W.W. Grainger
PAYX|Paychex
PAYC|Paycom Software
CTAS|Cintas
VRSK|Verisk Analytics
EFX|Equifax
BR|Broadridge Financial
MAS|Masco
ALLE|Allegion
PNR|Pentair
SWK|Stanley Black & Decker
SNA|Snap-on
TXT|Textron
GNRC|Generac Holdings
AOS|A.O. Smith
NDSN|Nordson
LII|Lennox International
WAB|Westinghouse Air Brake
J|Jacobs Solutions
PWR|Quanta Services
EME|EMCOR Group
CHRW|C.H. Robinson
EXPD|Expeditors International
ODFL|Old Dominion Freight
JBHT|J.B. Hunt Transport
LUV|Southwest Airlines
DAL|Delta Air Lines
UAL|United Airlines
AAL|American Airlines
ALK|Alaska Air Group
GEV|GE Vernova
`;

  // ---------- energía ----------
  var ENERGY = `
XOM|Exxon Mobil
CVX|Chevron
COP|ConocoPhillips
EOG|EOG Resources
SLB|SLB (Schlumberger)
PSX|Phillips 66
MPC|Marathon Petroleum
VLO|Valero Energy
OXY|Occidental Petroleum
WMB|Williams Companies
KMI|Kinder Morgan
OKE|ONEOK
HES|Hess Corporation
DVN|Devon Energy
FANG|Diamondback Energy
HAL|Halliburton
BKR|Baker Hughes
APA|APA Corporation
CTRA|Coterra Energy
EQT|EQT Corporation
TRGP|Targa Resources
SHEL|Shell plc
BP|BP plc
TTE|TotalEnergies
ENB|Enbridge
PBR|Petrobras
E|Eni S.p.A.
EC|Ecopetrol
`;

  // ---------- materiales ----------
  var MAT = `
LIN|Linde plc
APD|Air Products
SHW|Sherwin-Williams
ECL|Ecolab
FCX|Freeport-McMoRan
NEM|Newmont
NUE|Nucor
STLD|Steel Dynamics
VMC|Vulcan Materials
MLM|Martin Marietta Materials
DOW|Dow Inc.
DD|DuPont de Nemours
PPG|PPG Industries
LYB|LyondellBasell
IFF|International Flavors
ALB|Albemarle
CE|Celanese
EMN|Eastman Chemical
MOS|Mosaic
CF|CF Industries
FMC|FMC Corporation
PKG|Packaging Corp of America
IP|International Paper
AMCR|Amcor
BALL|Ball Corporation
AVY|Avery Dennison
SW|Smurfit Westrock
GOLD|Barrick Mining
AEM|Agnico Eagle Mines
VALE|Vale S.A.
RIO|Rio Tinto
BHP|BHP Group
TECK|Teck Resources
`;

  // ---------- inmobiliarias (REIT) ----------
  var RE = `
PLD|Prologis
AMT|American Tower
EQIX|Equinix
CCI|Crown Castle
PSA|Public Storage
SPG|Simon Property Group
O|Realty Income
WELL|Welltower
DLR|Digital Realty Trust
VTR|Ventas
AVB|AvalonBay Communities
EQR|Equity Residential
ESS|Essex Property Trust
MAA|Mid-America Apartment
UDR|UDR Inc.
CPT|Camden Property Trust
INVH|Invitation Homes
ARE|Alexandria Real Estate
BXP|BXP Inc.
KIM|Kimco Realty
REG|Regency Centers
FRT|Federal Realty
HST|Host Hotels & Resorts
EXR|Extra Space Storage
IRM|Iron Mountain
SBAC|SBA Communications
WY|Weyerhaeuser
DOC|Healthpeak Properties
CBRE|CBRE Group
CSGP|CoStar Group
`;

  // ---------- servicios públicos ----------
  var UTIL = `
NEE|NextEra Energy
SO|Southern Company
DUK|Duke Energy
SRE|Sempra
AEP|American Electric Power
D|Dominion Energy
EXC|Exelon
XEL|Xcel Energy
ED|Consolidated Edison
PEG|Public Service Enterprise
WEC|WEC Energy Group
ES|Eversource Energy
EIX|Edison International
DTE|DTE Energy
PPL|PPL Corporation
FE|FirstEnergy
AEE|Ameren
CMS|CMS Energy
CNP|CenterPoint Energy
ATO|Atmos Energy
NI|NiSource
LNT|Alliant Energy
EVRG|Evergy
PNW|Pinnacle West Capital
AES|AES Corporation
NRG|NRG Energy
VST|Vistra
CEG|Constellation Energy
`;

  // ---------- ADR y empresas argentinas en NYSE / Nasdaq ----------
  var ADR_AR = `
YPF|YPF S.A. (ADR)
PAM|Pampa Energía (ADR)
GGAL|Grupo Financiero Galicia (ADR)
BMA|Banco Macro (ADR)
BBAR|Banco BBVA Argentina (ADR)
SUPV|Grupo Supervielle (ADR)
EDN|Edenor (ADR)
CEPU|Central Puerto (ADR)
TGS|Transportadora de Gas del Sur (ADR)
CRESY|Cresud (ADR)
IRS|IRSA (ADR)
LOMA|Loma Negra (ADR)
TEO|Telecom Argentina (ADR)
DESP|Despegar
GLOB|Globant
MELI|MercadoLibre
VIST|Vista Energy
BIOX|Bioceres Crop Solutions
AGRO|Adecoagro
CAAP|Corporación América Airports
`;

  // ---------- ETF ----------
  var ETF = `
SPY|SPDR S&P 500 ETF
VOO|Vanguard S&P 500 ETF
IVV|iShares Core S&P 500 ETF
QQQ|Invesco Nasdaq-100 ETF
DIA|SPDR Dow Jones Industrial ETF
IWM|iShares Russell 2000 ETF
VTI|Vanguard Total Stock Market ETF
VEA|Vanguard FTSE Developed Markets
VWO|Vanguard FTSE Emerging Markets
EEM|iShares MSCI Emerging Markets
EFA|iShares MSCI EAFE
AGG|iShares Core U.S. Aggregate Bond
BND|Vanguard Total Bond Market
TLT|iShares 20+ Year Treasury Bond
IEF|iShares 7-10 Year Treasury Bond
SHY|iShares 1-3 Year Treasury Bond
LQD|iShares Investment Grade Corporate
HYG|iShares High Yield Corporate Bond
EMB|iShares J.P. Morgan USD Emerging Bond
GLD|SPDR Gold Shares
SLV|iShares Silver Trust
USO|United States Oil Fund
UNG|United States Natural Gas Fund
XLE|Energy Select Sector SPDR
XLF|Financial Select Sector SPDR
XLK|Technology Select Sector SPDR
XLV|Health Care Select Sector SPDR
XLI|Industrial Select Sector SPDR
XLY|Consumer Discretionary SPDR
XLP|Consumer Staples SPDR
XLU|Utilities Select Sector SPDR
XLB|Materials Select Sector SPDR
XLRE|Real Estate Select Sector SPDR
XLC|Communication Services SPDR
ARKK|ARK Innovation ETF
ARKG|ARK Genomic Revolution ETF
SOXX|iShares Semiconductor ETF
SMH|VanEck Semiconductor ETF
IBB|iShares Biotechnology ETF
XBI|SPDR S&P Biotech ETF
KRE|SPDR S&P Regional Banking ETF
ITB|iShares U.S. Home Construction
VNQ|Vanguard Real Estate ETF
SCHD|Schwab U.S. Dividend Equity ETF
JEPI|JPMorgan Equity Premium Income
QYLD|Global X Nasdaq-100 Covered Call
TQQQ|ProShares UltraPro QQQ
SQQQ|ProShares UltraPro Short QQQ
SPXL|Direxion Daily S&P 500 Bull 3X
UPRO|ProShares UltraPro S&P 500
VIXY|ProShares VIX Short-Term Futures
ARGT|Global X MSCI Argentina ETF
EWZ|iShares MSCI Brazil ETF
EWW|iShares MSCI Mexico ETF
ILF|iShares Latin America 40 ETF
EWJ|iShares MSCI Japan ETF
EWG|iShares MSCI Germany ETF
EWU|iShares MSCI United Kingdom ETF
FXI|iShares China Large-Cap ETF
MCHI|iShares MSCI China ETF
INDA|iShares MSCI India ETF
BITO|ProShares Bitcoin Strategy ETF
IBIT|iShares Bitcoin Trust
GBTC|Grayscale Bitcoin Trust
`;

  // ---------- índices ----------
  var INDEX = `
^GSPC|S&P 500
^DJI|Dow Jones Industrial Average
^IXIC|Nasdaq Composite
^NDX|Nasdaq 100
^RUT|Russell 2000
^VIX|Índice de volatilidad VIX
^MERV|S&P MERVAL (Argentina)
^BVSP|Bovespa (Brasil)
^MXX|IPC (México)
^GDAXI|DAX (Alemania)
^FTSE|FTSE 100 (Reino Unido)
^FCHI|CAC 40 (Francia)
^N225|Nikkei 225 (Japón)
^HSI|Hang Seng (Hong Kong)
^TNX|Bono del Tesoro EE.UU. 10 años
`;

  // ---------- divisas y materias primas ----------
  var FX = `
ARS=X|Dólar / Peso argentino
BRL=X|Dólar / Real brasileño
EURUSD=X|Euro / Dólar
GBPUSD=X|Libra / Dólar
USDJPY=X|Dólar / Yen
USDCLP=X|Dólar / Peso chileno
MXN=X|Dólar / Peso mexicano
DX-Y.NYB|Índice dólar (DXY)
GC=F|Oro (futuro)
SI=F|Plata (futuro)
CL=F|Petróleo WTI (futuro)
BZ=F|Petróleo Brent (futuro)
NG=F|Gas natural (futuro)
ZS=F|Soja (futuro)
ZC=F|Maíz (futuro)
ZW=F|Trigo (futuro)
`;

  function push(blob, type, extra) {
    blob.trim().split('\n').forEach(function (line) {
      var p = line.split('|');
      if (!p[0]) return;
      var it = { s: p[0].trim(), n: (p[1] || p[0]).trim(), mkt: 'us', type: type, ccy: 'USD' };
      if (extra) Object.keys(extra).forEach(function (k) { it[k] = extra[k]; });
      TV.RawCatalog.push(it);
    });
  }

  push(TECH, 'stock');
  push(COMM, 'stock');
  push(DISC, 'stock');
  push(STAPLES, 'stock');
  push(HEALTH, 'stock');
  push(FIN, 'stock');
  push(IND, 'stock');
  push(ENERGY, 'stock');
  push(MAT, 'stock');
  push(RE, 'stock');
  push(UTIL, 'stock');
  push(ADR_AR, 'adr');
  push(ETF, 'etf');
  push(INDEX, 'index');
  push(FX, 'fx');
})();
