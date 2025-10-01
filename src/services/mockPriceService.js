const mockPrices = {
  // Mock prices for common instruments
  'RELIANCE': { price: 2456.75, change: 12.50, changePercent: 0.51 },
  'INFY': { price: 1789.30, change: -8.20, changePercent: -0.46 },
  'TCS': { price: 3987.65, change: 45.30, changePercent: 1.15 },
  'HDFCBANK': { price: 1654.80, change: -15.60, changePercent: -0.93 },
  'ICICIBANK': { price: 1287.45, change: 23.75, changePercent: 1.88 },
  'SBIN': { price: 845.20, change: 8.90, changePercent: 1.06 },
  'NIFTY': { price: 25847.75, change: 125.30, changePercent: 0.49 },
  'BANKNIFTY': { price: 53456.80, change: -234.50, changePercent: -0.44 }
};

class MockPriceService {
  constructor() {
    this.isConnected = false;
    this.subscribers = new Set();
  }

  // Simulate connection
  connect() {
    this.isConnected = true;
    console.log('Mock price service connected');
    return Promise.resolve();
  }

  // Simulate disconnection
  disconnect() {
    this.isConnected = false;
    console.log('Mock price service disconnected');
  }

  // Get mock price for an instrument
  getPrice(symbol) {
    const baseSymbol = symbol.replace(/\d+/g, '').replace(/[A-Z]{2}$/, ''); // Remove numbers and CE/PE suffix
    const mockData = mockPrices[baseSymbol] || mockPrices[symbol];
    
    if (mockData) {
      // Add some random variation to make it look live
      const variation = (Math.random() - 0.5) * 10; // ±5 price variation
      const price = mockData.price + variation;
      const change = mockData.change + (Math.random() - 0.5) * 2;
      const changePercent = (change / (price - change)) * 100;
      
      return {
        instrument_token: symbol,
        last_price: parseFloat(price.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        change_percent: parseFloat(changePercent.toFixed(2)),
        volume: Math.floor(Math.random() * 1000000),
        timestamp: new Date().toISOString()
      };
    }
    
    // Return random price for unknown instruments
    const randomPrice = 100 + Math.random() * 2000;
    const randomChange = (Math.random() - 0.5) * 20;
    const changePercent = (randomChange / randomPrice) * 100;
    
    return {
      instrument_token: symbol,
      last_price: parseFloat(randomPrice.toFixed(2)),
      change: parseFloat(randomChange.toFixed(2)),
      change_percent: parseFloat(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 100000),
      timestamp: new Date().toISOString()
    };
  }

  // Get multiple prices
  getPrices(symbols) {
    const prices = {};
    symbols.forEach(symbol => {
      prices[symbol] = this.getPrice(symbol);
    });
    return Promise.resolve(prices);
  }

  // Subscribe to price updates (mock)
  subscribe(symbols) {
    symbols.forEach(symbol => this.subscribers.add(symbol));
    console.log('Subscribed to mock prices for:', symbols);
  }

  // Unsubscribe from price updates (mock)
  unsubscribe(symbols) {
    symbols.forEach(symbol => this.subscribers.delete(symbol));
    console.log('Unsubscribed from mock prices for:', symbols);
  }

  // Check if service is connected
  isServiceConnected() {
    return this.isConnected;
  }
}

module.exports = MockPriceService;
