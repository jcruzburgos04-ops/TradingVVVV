/* LibreCharts — catálogo de criptomonedas.
 *
 * Cada par indica dónde se puede operar. La marca `B` significa que además de
 * estar en Binance cotiza como perpetuo USDT en Bybit, que es donde opera el
 * usuario: esos son los que se piden a Bybit primero. La marca `S` indica que
 * en Bybit existe sólo en spot (no hay perpetuo), y `-` que no está en Bybit.
 *
 * Nota: la lista de Bybit se armó con los perpetuos USDT habituales de la
 * plataforma. Bybit da de alta pares nuevos seguido: si alguno no responde,
 * la aplicación cae automáticamente en Binance y lo avisa en la barra
 * inferior, así que nada queda sin gráfico. */
(function () {
  'use strict';
  window.TV = window.TV || {};
  TV.RawCatalog = TV.RawCatalog || [];

  var PAIRS = `
BTCUSDT|Bitcoin|B
ETHUSDT|Ethereum|B
BNBUSDT|BNB|B
SOLUSDT|Solana|B
XRPUSDT|XRP|B
ADAUSDT|Cardano|B
DOGEUSDT|Dogecoin|B
AVAXUSDT|Avalanche|B
DOTUSDT|Polkadot|B
LINKUSDT|Chainlink|B
POLUSDT|Polygon|B
LTCUSDT|Litecoin|B
TRXUSDT|TRON|B
SHIBUSDT|Shiba Inu|B
UNIUSDT|Uniswap|B
ATOMUSDT|Cosmos|B
XLMUSDT|Stellar|B
NEARUSDT|NEAR Protocol|B
APTUSDT|Aptos|B
ARBUSDT|Arbitrum|B
OPUSDT|Optimism|B
FILUSDT|Filecoin|B
INJUSDT|Injective|B
SUIUSDT|Sui|B
PEPEUSDT|Pepe|B
RENDERUSDT|Render|B
AAVEUSDT|Aave|B
ALGOUSDT|Algorand|B
TONUSDT|Toncoin|B
SANDUSDT|The Sandbox|B
MANAUSDT|Decentraland|B
ICPUSDT|Internet Computer|B
VETUSDT|VeChain|B
HBARUSDT|Hedera|B
EOSUSDT|EOS|B
XTZUSDT|Tezos|B
THETAUSDT|Theta|B
GRTUSDT|The Graph|B
ETCUSDT|Ethereum Classic|B
BCHUSDT|Bitcoin Cash|B
WLDUSDT|Worldcoin|B
SEIUSDT|Sei|B
TIAUSDT|Celestia|B
JUPUSDT|Jupiter|B
ORDIUSDT|ORDI|B
WIFUSDT|dogwifhat|B
FETUSDT|Artificial Superintelligence|B
STXUSDT|Stacks|B
IMXUSDT|Immutable|B
RUNEUSDT|THORChain|B
GALAUSDT|Gala|B
AXSUSDT|Axie Infinity|B
CRVUSDT|Curve DAO|B
LDOUSDT|Lido DAO|B
ENAUSDT|Ethena|B
PENDLEUSDT|Pendle|B
ETHBTC|Ethereum / Bitcoin|S
BNBBTC|BNB / Bitcoin|-
SOLBTC|Solana / Bitcoin|-
EURUSDT|Euro / USDT|-
`;

  PAIRS.trim().split('\n').forEach(function (line) {
    var p = line.split('|');
    if (!p[0]) return;
    var s = p[0].trim();
    var bybit = (p[2] || '-').trim();
    TV.RawCatalog.push({
      s: s, n: (p[1] || s).trim(), mkt: 'crypto', type: 'crypto',
      ccy: /USDT$/.test(s) ? 'USDT' : (/BTC$/.test(s) ? 'BTC' : ''),
      bybit: bybit !== '-',
      bybitSpotOnly: bybit === 'S'
    });
  });
})();
