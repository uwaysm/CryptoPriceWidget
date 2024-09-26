const axios = require('axios');
const { ipcRenderer, remote } = require('electron');

let tickers = ['BTC', 'ETH'];
const REFRESH_INTERVAL = 120000; // 1 minute
let tickerToId = {};
let isInitialized = false;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 5000; 
let currentCustomization = {}; 

async function fetchWithRetry(url, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url);
      if (response.status === 200) {
        return response;
      }
    } catch (error) {
      console.log(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; 
    }
  }
  throw new Error(`Failed to fetch after ${retries} retries`);
}

function initializeCoinList(coinList) {
  if (!coinList || !Array.isArray(coinList)) {
    console.error('Coin list is null, undefined, or not an array');
    notifyUser('Error loading coin data. Please check the coingecko-ids.json file.');
    return;
  }
  
  tickerToId = coinList.reduce((acc, coin) => {
    if (coin.symbol && coin.id) {
      // Convert symbol to uppercase for case-insensitive matching
      const upperSymbol = coin.symbol.toUpperCase();
      // If the symbol already exists, prefer the shorter ID (usually the "main" coin)
      if (!acc[upperSymbol] || coin.id.length < acc[upperSymbol].length) {
        acc[upperSymbol] = coin.id;
      }
    }
    return acc;
  }, {});
  
  console.log('Coin list loaded. Sample:', 
    Object.fromEntries(Object.entries(tickerToId).slice(0, 10)));
  console.log('BTC mapping:', tickerToId['BTC']);
  console.log('ETH mapping:', tickerToId['ETH']);
  isInitialized = true;
}

async function fetchPrices() {
  if (!isInitialized) {
    console.log('Waiting for initialization...');
    return;
  }
  try {
    const ids = tickers.map(ticker => {
      const id = tickerToId[ticker];
      console.log(`Mapping ${ticker} to ID: ${id}`);
      return id;
    }).filter(id => id);
    console.log('Fetching prices for IDs:', ids);
    if (ids.length === 0) {
      console.log('No valid tickers to fetch');
      return;
    }
    const API_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
    console.log('Fetching from URL:', API_URL);
    const response = await fetchWithRetry(API_URL);
    const data = response.data;
    console.log('Received data:', data);

    updatePriceDisplay(data);
  } catch (error) {
    console.error('Error fetching prices:', error);
    notifyUser('Error updating prices. Will try again soon.');
  }
}

function updatePriceDisplay(data) {
  console.log('Updating price display with data:', data);
  const tickerElements = document.querySelectorAll('.ticker');
  tickerElements.forEach(ticker => {
    const symbol = ticker.dataset.symbol;
    const id = tickerToId[symbol];
    console.log(`Processing ticker: ${symbol}, ID: ${id}`);
    const price = data[id]?.usd;
    if (price) {
      console.log(`Updating price for ${symbol}: $${price.toFixed(2)}`);
      ticker.querySelector('.price').textContent = `$${price.toFixed(2)}`;
    } else {
      console.log(`No price found for ${symbol} (ID: ${id})`);
      ticker.querySelector('.price').textContent = 'N/A';
    }
  });
}

function notifyUser(message) {
  console.log(message);
}

function updateTickerDisplay() {
  const content = document.getElementById('content');
  content.innerHTML = '';
  tickers.forEach(ticker => {
    const tickerElement = document.createElement('div');
    tickerElement.className = 'ticker';
    tickerElement.dataset.symbol = ticker;
    tickerElement.innerHTML = `
      <span class="symbol">${ticker}:</span>
      <span class="price">Loading...</span>
    `;
    content.appendChild(tickerElement);
  });
  adjustVisibleTickers();
  applyCustomization(currentCustomization);
}

// Simplify the dragging logic
let isDragging = false;
let startPosition = { x: 0, y: 0 };

function enableDragging(element) {
  element.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
      isDragging = true;
      startPosition = { x: e.screenX - remote.getCurrentWindow().getPosition()[0], y: e.screenY - remote.getCurrentWindow().getPosition()[1] };
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newX = e.screenX - startPosition.x;
    const newY = e.screenY - startPosition.y;
    remote.getCurrentWindow().setPosition(newX, newY);
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// Modify the existing context menu listener
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!isDragging) {
    ipcRenderer.send('show-context-menu');
  }
});

// Enable dragging on the entire window
enableDragging(document.body);

(async function init() {
  // Wait for the coin list to be received
  await new Promise(resolve => {
    ipcRenderer.once('coin-list', (event, coinList) => {
      initializeCoinList(coinList);
      resolve();
    });
  });

  updateTickerDisplay();
  await fetchPrices(); // Wait for the initial price fetch
  
  // Request initial customization from main process
  ipcRenderer.send('get-initial-customization');

  // Enable dragging on the entire window
  enableDragging(document.body);

  setInterval(fetchPrices, REFRESH_INTERVAL);
})();

// Add this new event listener for initial customization
ipcRenderer.on('initial-customization', (event, initialCustomization) => {
  applyCustomization(initialCustomization);
  fetchPrices(); // Fetch prices again after applying customization
});

// Add this event listener for updating tickers
ipcRenderer.on('update-tickers', (event, newTickers) => {
  tickers = newTickers;
  updateTickerDisplay();
  fetchPrices();
});

// Add this function to apply customization
function applyCustomization(customization) {
  console.log('Applying customization:', customization);
  document.body.style.fontFamily = customization.fontFamily || 'Arial';
  document.body.style.backgroundColor = customization.bgColor || '#333';

  const tickers = document.querySelectorAll('.ticker');
  tickers.forEach(ticker => {
    ticker.style.fontSize = `${customization.tickerSize || 20}px`;
    const symbolElement = ticker.querySelector('.symbol');
    const priceElement = ticker.querySelector('.price');
    
    if (symbolElement) symbolElement.style.color = customization.tickerColor || '#ffd700';
    if (priceElement) {
      priceElement.style.color = customization.priceColor || '#90ee90';
      priceElement.style.fontSize = `${customization.priceSize || 20}px`;
    }
  });
}

// Add this new event listener for the coin list
ipcRenderer.on('coin-list', (event, coinList) => {
  initializeCoinList(coinList);
});

// Add this new event listener for applying customization
ipcRenderer.on('apply-customization', (event, newCustomization) => {
  console.log('Received new customization:', newCustomization);
  currentCustomization = newCustomization;
  applyCustomization(newCustomization);
});

console.log('renderer.js loaded');