/* LibreCharts — catálogo de criptomonedas (pares de Binance). */
(function () {
  'use strict';
  window.TV = window.TV || {};
  TV.RawCatalog = TV.RawCatalog || [];

  var PAIRS = `
BTCUSDT|Bitcoin
ETHUSDT|Ethereum
BNBUSDT|BNB
SOLUSDT|Solana
XRPUSDT|XRP
ADAUSDT|Cardano
DOGEUSDT|Dogecoin
AVAXUSDT|Avalanche
DOTUSDT|Polkadot
LINKUSDT|Chainlink
POLUSDT|Polygon
LTCUSDT|Litecoin
TRXUSDT|TRON
SHIBUSDT|Shiba Inu
UNIUSDT|Uniswap
ATOMUSDT|Cosmos
XLMUSDT|Stellar
NEARUSDT|NEAR Protocol
APTUSDT|Aptos
ARBUSDT|Arbitrum
OPUSDT|Optimism
FILUSDT|Filecoin
INJUSDT|Injective
SUIUSDT|Sui
PEPEUSDT|Pepe
RENDERUSDT|Render
AAVEUSDT|Aave
ALGOUSDT|Algorand
TONUSDT|Toncoin
SANDUSDT|The Sandbox
MANAUSDT|Decentraland
ICPUSDT|Internet Computer
VETUSDT|VeChain
HBARUSDT|Hedera
EOSUSDT|EOS
XTZUSDT|Tezos
THETAUSDT|Theta
GRTUSDT|The Graph
ETCUSDT|Ethereum Classic
BCHUSDT|Bitcoin Cash
WLDUSDT|Worldcoin
SEIUSDT|Sei
TIAUSDT|Celestia
JUPUSDT|Jupiter
ETHBTC|Ethereum / Bitcoin
BNBBTC|BNB / Bitcoin
SOLBTC|Solana / Bitcoin
EURUSDT|Euro / USDT
`;

  PAIRS.trim().split('\n').forEach(function (line) {
    var p = line.split('|');
    if (!p[0]) return;
    var s = p[0].trim();
    TV.RawCatalog.push({
      s: s, n: (p[1] || s).trim(), mkt: 'crypto', type: 'crypto',
      ccy: /USDT$/.test(s) ? 'USDT' : (/BTC$/.test(s) ? 'BTC' : '')
    });
  });
})();
