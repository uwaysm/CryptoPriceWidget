const { app, BrowserWindow, screen, ipcMain, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const axios = require('axios');

const store = new Store();
let mainWindow, settingsWindow;
let tickers = ['BTC', 'ETH'];
let customization = {};

function loadCoinList() {
  try {
    const filePath = path.join(__dirname, 'coingecko-ids.json');
    const jsonData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(jsonData);
  } catch (error) {
    console.error('Error reading coingecko-ids.json:', error);
    return null;
  }
}

function createWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: 200,
    height: 100,
    x: width - 220,
    y: 20,
    frame: false, // Add this line to remove the window frame
    alwaysOnTop: true,
    transparent: true, // Add this line to make the background transparent
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  const coinList = loadCoinList();
  mainWindow.loadFile('index.html');
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true);
  
  // Remove this line to allow dragging
  // mainWindow.setMenu(null);
  
  // Remove this block to allow dragging
  /*
  mainWindow.hookWindowMessage(278, function (e) {
    mainWindow.setEnabled(false);
    setTimeout(() => {
      mainWindow.setEnabled(true);
    }, 100);
    return true;
  });
  */

  // Remove or comment out the following line to prevent DevTools from opening on startup
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Load saved tickers or use defaults
  const savedTickers = store.get('tickers', ['BTC', 'ETH']);
  mainWindow.webContents.on('did-finish-load', () => {
    const coinList = loadCoinList();
    if (coinList) {
      mainWindow.webContents.send('coin-list', coinList);
    } else {
      console.error('Failed to load coin list');
    }
    const savedTickers = store.get('tickers', ['BTC', 'ETH']);
    const savedCustomization = store.get('customization', {});
    mainWindow.webContents.send('update-tickers', savedTickers);
    mainWindow.webContents.send('apply-customization', savedCustomization);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 300,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // Send saved tickers and customization to the settings window
  const savedTickers = store.get('tickers', ['BTC', 'ETH']);
  const savedCustomization = store.get('customization', {});
  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.webContents.send('load-settings', { tickers: savedTickers, customization: savedCustomization });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('open-settings', () => {
  console.log('Received open-settings event');
  if (!settingsWindow) {
    createSettingsWindow();
  } else {
    settingsWindow.focus();
  }
});

ipcMain.on('update-ticker', (event, ticker) => {
  console.log('Received update-ticker event with ticker:', ticker);
  mainWindow.webContents.send('update-ticker', ticker);
});

ipcMain.on('show-context-menu', (event) => {
  const template = [
    {
      label: 'Settings',
      click: () => {
        if (!settingsWindow) {
          createSettingsWindow();
        } else {
          settingsWindow.focus();
        }
      }
    },
    {
      label: 'Open DevTools',
      click: () => {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    },
    { type: 'separator' },
    { role: 'minimize' },
    { role: 'close' }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
});

ipcMain.on('update-tickers', (event, newTickers) => {
  store.set('tickers', newTickers);
  tickers = newTickers;
  if (mainWindow) {
    mainWindow.webContents.send('update-tickers', newTickers);
  }
});

ipcMain.on('update-customization', (event, newCustomization) => {
  store.set('customization', newCustomization);
  customization = newCustomization;
  if (mainWindow) {
    mainWindow.webContents.send('apply-customization', customization);
  }
});

ipcMain.on('settings-updated', () => {
  if (mainWindow) {
    const savedTickers = store.get('tickers', ['BTC', 'ETH']);
    const savedCustomization = store.get('customization', {});
    mainWindow.webContents.send('update-tickers', savedTickers);
    mainWindow.webContents.send('apply-customization', savedCustomization);
  }
});

// Add this new IPC handler
ipcMain.on('get-initial-customization', (event) => {
  const initialCustomization = store.get('customization', {});
  event.reply('initial-customization', initialCustomization);
});

function saveSettings() {
  const settings = { tickers, customization };
  fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings));
}

function loadSettings() {
  try {
    const settingsFile = fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8');
    const settings = JSON.parse(settingsFile);
    tickers = settings.tickers || ['BTC', 'ETH'];
    customization = settings.customization || {};
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Call loadSettings() when the app starts
app.on('ready', () => {
  loadSettings();
  createWindow();
});

async function fetchPrices(tickers) {
  const prices = {};
  const coinGeckoTickers = tickers.filter(t => !t.startsWith('token:'));
  const tokenAddresses = tickers.filter(t => t.startsWith('token:')).map(t => t.split(':')[1]);

  if (coinGeckoTickers.length > 0) {
    const coinGeckoPrices = await fetchCoinGeckoPrices(coinGeckoTickers);
    Object.assign(prices, coinGeckoPrices);
  }

  if (tokenAddresses.length > 0) {
    const dexScreenerPrices = await fetchDexScreenerPrices(tokenAddresses);
    Object.assign(prices, dexScreenerPrices);
  }

  return prices;
}

async function fetchCoinGeckoPrices(tickers) {
  // ... existing CoinGecko fetching logic ...
}

async function fetchDexScreenerPrices(tokenAddresses) {
  const prices = {};
  try {
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses.join(',')}`);
    response.data.pairs.forEach(pair => {
      prices[`token:${pair.baseToken.address}`] = {
        symbol: pair.baseToken.symbol,
        price: parseFloat(pair.priceUsd)
      };
    });
  } catch (error) {
    console.error('Error fetching DEXScreener prices:', error);
  }
  return prices;
}

// ... (other existing code)