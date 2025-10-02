// Mock price service for generating realistic live prices
class MockPriceService {
  constructor() {
    this.basePrices = {
      'RELIANCE': 2456.75,
      'TCS': 3987.65,
      'INFY': 1789.30,
      'HDFCBANK': 1654.80,
      'ICICIBANK': 1234.50,
      'SBIN': 789.25,
      'LT': 3456.90,
      'WIPRO': 567.40,
      'MARUTI': 12345.60,
      'BAJFINANCE': 8765.30,
      'NIFTY': 25847.75,
      'BANKNIFTY': 53456.80,
      'FINNIFTY': 19876.45,
      'GOLD': 65432.10,
      'SILVER': 87654.30,
      'CRUDEOIL': 6789.45,
      'NATURALGAS': 234.56
    };
    
    this.priceCache = {};
    this.lastUpdate = {};
  }

  getPrice(symbol) {
    if (!symbol) {
      return null;
    }

    // Clean symbol for lookup
    const cleanSymbol = this.extractBaseSymbol(symbol);
    const basePrice = this.basePrices[cleanSymbol];
    
    if (!basePrice) {
      // Generate a random price for unknown symbols
      return this.generateRandomPrice(symbol);
    }

    // Check if we need to update the price (every 5 seconds)
    const now = Date.now();
    const cacheKey = symbol;
    
    if (!this.lastUpdate[cacheKey] || (now - this.lastUpdate[cacheKey]) > 5000) {
      this.priceCache[cacheKey] = this.generateLivePrice(basePrice, cleanSymbol);
      this.lastUpdate[cacheKey] = now;
    }

    return this.priceCache[cacheKey];
  }

  extractBaseSymbol(symbol) {
    // Extract base symbol from complex trading symbols
    if (symbol.includes('NIFTY')) return 'NIFTY';
    if (symbol.includes('BANKNIFTY')) return 'BANKNIFTY';
    if (symbol.includes('FINNIFTY')) return 'FINNIFTY';
    if (symbol.includes('RELIANCE')) return 'RELIANCE';
    if (symbol.includes('TCS')) return 'TCS';
    if (symbol.includes('INFY')) return 'INFY';
    if (symbol.includes('HDFC')) return 'HDFCBANK';
    if (symbol.includes('ICICI')) return 'ICICIBANK';
    if (symbol.includes('SBIN')) return 'SBIN';
    if (symbol.includes('LT')) return 'LT';
    if (symbol.includes('WIPRO')) return 'WIPRO';
    if (symbol.includes('MARUTI')) return 'MARUTI';
    if (symbol.includes('BAJAJ')) return 'BAJFINANCE';
    if (symbol.includes('GOLD')) return 'GOLD';
    if (symbol.includes('SILVER')) return 'SILVER';
    if (symbol.includes('CRUDE')) return 'CRUDEOIL';
    if (symbol.includes('GAS')) return 'NATURALGAS';
    
    return symbol.toUpperCase();
  }

  generateLivePrice(basePrice, symbol) {
    // Generate realistic price movements
    const variation = (Math.random() - 0.5) * 10; // ±5 points variation
    const currentPrice = basePrice + variation;
    
    // Calculate change from base price
    const change = currentPrice - basePrice;
    const changePercent = (change / basePrice) * 100;
    
    // Generate volume (random between 10K to 1M)
    const volume = Math.floor(Math.random() * 990000) + 10000;
    
    return {
      price: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: volume,
      timestamp: new Date().toISOString(),
      high: parseFloat((currentPrice + Math.random() * 5).toFixed(2)),
      low: parseFloat((currentPrice - Math.random() * 5).toFixed(2)),
      open: parseFloat((basePrice + (Math.random() - 0.5) * 3).toFixed(2))
    };
  }

  generateRandomPrice(symbol) {
    // Generate random price for unknown symbols
    const randomBase = Math.random() * 5000 + 100; // Between 100 and 5100
    return this.generateLivePrice(randomBase, symbol);
  }

  // Get multiple prices at once
  getPrices(symbols) {
    const prices = {};
    symbols.forEach(symbol => {
      prices[symbol] = this.getPrice(symbol);
    });
    return prices;
  }

  // Simulate market status
  isMarketOpen() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Market hours: 9:15 AM to 3:30 PM, Monday to Friday
    return (day >= 1 && day <= 5) && (hour >= 9 && hour < 15);
  }
}

// Export singleton instance
module.exports = new MockPriceService();
