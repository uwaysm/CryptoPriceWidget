const axios = require('axios');
const { ipcRenderer, remote } = require('electron');

let tickers = ['BTC', 'ETH'];
const REFRESH_INTERVAL = 60000; // 1 minute
let tickerToId = {};

async function fetchCoinList() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/list');
    const coinList = response.data;
    tickerToId = coinList.reduce((acc, coin) => {
      acc[coin.symbol.toUpperCase()] = coin.id;
      return acc;
    }, {});
    console.log('Coin list fetched and mapped');
  } catch (error) {
    console.error('Error fetching coin list:', error);
  }
}

async function fetchPrices() {
  try {
    const ids = tickers.map(ticker => tickerToId[ticker]).filter(id => id);
    if (ids.length === 0) {
      console.log('No valid tickers to fetch');
      return;
    }
    const API_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
    const response = await axios.get(API_URL);
    const data = response.data;

    const tickerElements = document.querySelectorAll('.ticker');
    tickerElements.forEach(ticker => {
      const symbol = ticker.dataset.symbol;
      const id = tickerToId[symbol];
      const price = data[id]?.usd;
      if (price) {
        ticker.querySelector('.price').textContent = `$${price.toFixed(2)}`;
      } else {
        ticker.querySelector('.price').textContent = 'N/A';
      }
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    const tickerElements = document.querySelectorAll('.ticker');
    tickerElements.forEach(ticker => {
      ticker.querySelector('.price').textContent = 'Error';
    });
  }
}

function updateTickerDisplay() {
  const content = document.getElementById('content');
  content.innerHTML = '';
  tickers.forEach(ticker => {
    const tickerElement = document.createElement('div');
    tickerElement.className = 'ticker';
    tickerElement.dataset.symbol = ticker;
    tickerElement.innerHTML = `
      <div class="price">Loading...</div>
      <div class="symbol">${ticker}</div>
    `;
    content.appendChild(tickerElement);
  });
  adjustVisibleTickers();
}

// Make the window draggable from the drag region
const win = remote.getCurrentWindow();
const dragRegion = document.getElementById('drag-region');

dragRegion.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left click
    win.beginMoving();
  }
});

// Show custom context menu on right-click anywhere in the window
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ipcRenderer.send('show-context-menu');
});

// Update tickers when settings change
ipcRenderer.on('update-tickers', (event, newTickers) => {
  console.log('Received update-tickers event with tickers:', newTickers);
  tickers = newTickers;
  updateTickerDisplay();
  fetchPrices();
});

(async function init() {
  await fetchCoinList();
  updateTickerDisplay();
  fetchPrices();
  setInterval(fetchPrices, REFRESH_INTERVAL);
})();

console.log('renderer.js loaded');