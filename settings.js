const { ipcRenderer } = require('electron');
const axios = require('axios');

let tickers = [];
let validTickers = {};
let isValidTickersLoaded = false;
let customization = {};

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
		isValidTickersLoaded = true;
		console.log('Valid tickers fetched');
	} catch (error) {
		console.error('Error fetching valid tickers:', error);
	}
}

async function isValidTokenAddress(address) {
	try {
		const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
		return response.data.pairs && response.data.pairs.length > 0;
	} catch (error) {
		console.error('Error validating token address:', error);
		return false;
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
	saveSettings(); // Save both tickers and customization
}

function loadCustomization() {
	customization = {
		fontFamily: document.getElementById('font-family').value,
		tickerSize: document.getElementById('ticker-size').value,
		priceSize: document.getElementById('price-size').value,
		tickerColor: document.getElementById('ticker-color').value,
		priceColor: document.getElementById('price-color').value,
		bgColor: document.getElementById('bg-color').value
	};
	console.log('Loaded customization:', customization);
}

function saveCustomization() {
	loadCustomization();
	ipcRenderer.send('update-customization', customization);
	console.log('Saved customization:', customization);
}

function saveSettings() {
	loadCustomization();
	ipcRenderer.send('update-tickers', tickers);
	ipcRenderer.send('update-customization', customization);
	console.log('Saved settings - Tickers:', tickers, 'Customization:', customization);
}

document.getElementById('add-ticker').addEventListener('click', async () => {
	const newInput = document.getElementById('new-ticker').value.trim();
	const inputType = document.getElementById('input-type').value;

	if (!newInput) {
		alert('Please enter a ticker symbol or token address.');
		return;
	}

	if (inputType === 'ticker') {
		const newTicker = newInput.toUpperCase();
		if (!isValidTickersLoaded) {
			alert('Please wait, still loading valid tickers...');
			return;
		}
		if (newTicker && !tickers.includes(newTicker) && validTickers[newTicker]) {
			tickers.push(newTicker);
			renderTickers();
			document.getElementById('new-ticker').value = '';
			saveSettings();
		} else {
			alert('Invalid or duplicate ticker. Please enter a valid, unique ticker symbol.');
		}
	} else if (inputType === 'token') {
		if (await isValidTokenAddress(newInput)) {
			tickers.push(`token:${newInput}`);
			renderTickers();
			document.getElementById('new-ticker').value = '';
			saveSettings();
		} else {
			alert('Invalid token address. Please enter a valid token address.');
		}
	}
});

document.getElementById('save').addEventListener('click', () => {
	saveSettings();
	ipcRenderer.send('settings-updated');
	window.close();
});

// Load saved tickers and customization when the settings window opens
ipcRenderer.on('load-settings', (event, savedSettings) => {
	console.log('Received saved settings:', savedSettings);
	tickers = savedSettings.tickers || [];
	customization = savedSettings.customization || {};
	
	// Set customization values
	document.getElementById('font-family').value = customization.fontFamily || 'Arial';
	document.getElementById('ticker-size').value = customization.tickerSize || 20;
	document.getElementById('price-size').value = customization.priceSize || 20;
	document.getElementById('ticker-color').value = customization.tickerColor || '#ffd700';
	document.getElementById('price-color').value = customization.priceColor || '#90ee90';
	document.getElementById('bg-color').value = customization.bgColor || '#333333';
	
	// Update the displayed values for range inputs
	document.querySelectorAll('input[type="range"]').forEach(input => {
		const valueSpan = document.getElementById(`${input.id}-value`);
		if (valueSpan) {
			valueSpan.textContent = input.value;
		}
	});
	
	console.log('Applied saved settings to UI');
	
	fetchValidTickers().then(() => {
		renderTickers();
	});
});

// Add event listeners for real-time preview and saving
document.querySelectorAll('input, select').forEach(element => {
	element.addEventListener('change', () => {
		console.log(`${element.id} changed to ${element.value}`);
		saveCustomization();
	});
	
	// For range inputs, also update on input event
	if (element.type === 'range') {
		element.addEventListener('input', () => {
			const valueSpan = document.getElementById(`${element.id}-value`);
			if (valueSpan) {
				valueSpan.textContent = element.value;
			}
			saveCustomization();
		});
	}
});

console.log('settings.js loaded');