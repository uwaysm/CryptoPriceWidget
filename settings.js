const { ipcRenderer } = require('electron');
const axios = require('axios');

let tickers = [];
let validTickers = {};

async function fetchValidTickers() {
	try {
		const response = await axios.get('https://api.coingecko.com/api/v3/coins/list');
		const coinList = response.data;
		validTickers = coinList.reduce((acc, coin) => {
			if (coin.symbol) {
				const upperSymbol = coin.symbol.toUpperCase();
				acc[upperSymbol] = true;
			}
			return acc;
		}, {});
		console.log('Valid tickers fetched');
	} catch (error) {
		console.error('Error fetching valid tickers:', error);
	}
}

function renderTickers() {
	const tickerList = document.getElementById('ticker-list');
	tickerList.innerHTML = '';
	tickers.forEach((ticker, index) => {
		const tickerItem = document.createElement('div');
		tickerItem.className = 'ticker-item';
		tickerItem.innerHTML = `
			<span>${ticker}</span>
			<button onclick="removeTicker(${index})">Remove</button>
		`;
		tickerList.appendChild(tickerItem);
	});
}

function removeTicker(index) {
	tickers.splice(index, 1);
	renderTickers();
}

document.getElementById('add-ticker').addEventListener('click', () => {
	const newTicker = document.getElementById('new-ticker').value.trim().toUpperCase();
	if (newTicker && !tickers.includes(newTicker) && validTickers[newTicker]) {
		tickers.push(newTicker);
		renderTickers();
		document.getElementById('new-ticker').value = '';
	} else {
		alert('Invalid or duplicate ticker. Please enter a valid, unique ticker symbol.');
	}
});

document.getElementById('save').addEventListener('click', () => {
	ipcRenderer.send('update-tickers', tickers);
	window.close();
});

// Load saved tickers when the settings window opens
ipcRenderer.on('load-tickers', (event, savedTickers) => {
	tickers = savedTickers || [];
	fetchValidTickers().then(() => {
		renderTickers();
	});
});