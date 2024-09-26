const { app, BrowserWindow, screen, ipcMain, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow, settingsWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: 200,
    height: 100,
    x: width - 220,
    y: 20,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true);
  
  // Disable default menu
  mainWindow.setMenu(null);
  
  // Disable the default context menu
  mainWindow.hookWindowMessage(278, function (e) {
    mainWindow.setEnabled(false);
    setTimeout(() => {
      mainWindow.setEnabled(true);
    }, 100);
    return true;
  });
  
  // Remove or comment out the following line to prevent DevTools from opening on startup
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Load saved tickers or use defaults
  const savedTickers = store.get('tickers', ['BTC', 'ETH']);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('update-tickers', savedTickers);
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

  // Send saved tickers to the settings window
  const savedTickers = store.get('tickers', ['BTC', 'ETH']);
  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.webContents.send('load-tickers', savedTickers);
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
    { type: 'separator' },
    { role: 'minimize' },
    { role: 'close' }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
});

ipcMain.on('update-tickers', (event, newTickers) => {
  store.set('tickers', newTickers);
  if (mainWindow) {
    mainWindow.webContents.send('update-tickers', newTickers);
  }
});