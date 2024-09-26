# CryptoPriceWidget

CryptoPriceWidget is a lightweight, customizable desktop widget that displays real-time cryptocurrency prices. Built with Electron, it provides an always-on-top window that shows the current prices of selected cryptocurrencies.

## Features

- Real-time price updates for multiple cryptocurrencies
- Customizable ticker selection
- Always-on-top widget
- Draggable interface
- Minimalistic design

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/uwaysm/CryptoPriceWidget.git
   ```

2. Navigate to the project directory:
   ```
   cd CryptoPriceWidget
   ```

3. Install dependencies:
   ```
   npm install
   ```

## Usage

To start the application, run:

npm start

Right-click on the widget to access the context menu, where you can open the settings or close the application.

## Customization

You can customize the displayed cryptocurrencies by:

1. Right-clicking on the widget
2. Selecting "Settings" from the context menu
3. Adding or removing tickers in the settings window

## Development

This project uses:
- Electron for the desktop application framework
- Axios for API requests
- electron-store for persistent storage

To modify the widget's appearance, edit the CSS in `index.html`.


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgements

- Cryptocurrency data provided by [CoinGecko API](https://www.coingecko.com/en/api/documentation)
- Built with [Electron](https://www.electronjs.org/)
