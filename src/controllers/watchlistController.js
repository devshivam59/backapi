// Simple watchlist controller that only uses mock prices
// In-memory storage for watchlists (replace with database in production)
let watchlists = [
  {
    id: 'demo-watchlist-1',
    name: 'My Watchlist',
    instruments: [],
    createdAt: new Date()
  }
];

// Mock price data
const mockPrices = {
  'RELIANCE': {
    last_price: 2456.75,
    change: 12.50,
    change_percent: 0.51,
    volume: 1234567,
    timestamp: new Date().toISOString()
  },
  'INFY': {
    last_price: 1789.30,
    change: -8.25,
    change_percent: -0.46,
    volume: 987654,
    timestamp: new Date().toISOString()
  },
  'TCS': {
    last_price: 3987.65,
    change: 45.30,
    change_percent: 1.15,
    volume: 654321,
    timestamp: new Date().toISOString()
  },
  'NIFTY': {
    last_price: 25847.75,
    change: 125.40,
    change_percent: 0.49,
    volume: 2345678,
    timestamp: new Date().toISOString()
  },
  'BANKNIFTY': {
    last_price: 53456.80,
    change: -235.60,
    change_percent: -0.44,
    volume: 3456789,
    timestamp: new Date().toISOString()
  }
};

// Generate mock price for any symbol
const getMockPrice = (symbol) => {
  if (mockPrices[symbol]) {
    // Add small random variation to simulate live prices
    const basePrice = mockPrices[symbol];
    const variation = (Math.random() - 0.5) * 10; // ±5 points variation
    return {
      last_price: basePrice.last_price + variation,
      change: basePrice.change + (variation * 0.1),
      change_percent: ((basePrice.change + (variation * 0.1)) / basePrice.last_price) * 100,
      volume: basePrice.volume + Math.floor(Math.random() * 10000),
      timestamp: new Date().toISOString()
    };
  }
  
  // Generate random price for unknown symbols
  const basePrice = 1000 + Math.random() * 2000;
  const change = (Math.random() - 0.5) * 50;
  return {
    last_price: basePrice,
    change: change,
    change_percent: (change / basePrice) * 100,
    volume: Math.floor(Math.random() * 1000000),
    timestamp: new Date().toISOString()
  };
};

// Market hours check (9:15 AM to 3:30 PM IST, Monday-Friday)
const isMarketOpen = () => {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST
  const day = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = istTime.getHours();
  const minute = istTime.getMinutes();
  
  // Check if it's a weekday (Monday-Friday)
  if (day === 0 || day === 6) return false;
  
  // Check if it's within market hours (9:15 AM to 3:30 PM)
  const currentTime = hour * 60 + minute;
  const marketOpen = 9 * 60 + 15; // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  
  return currentTime >= marketOpen && currentTime <= marketClose;
};

// Get market status
const getMarketStatus = async (req, res) => {
  try {
    const isOpen = isMarketOpen();
    
    res.json({
      isOpen,
      connectionType: 'Mock Prices',
      wsConnected: false,
      subscribedTokens: [],
      accessToken: false,
      apiKey: 'mock-service'
    });
  } catch (error) {
    console.error('Error getting market status:', error);
    res.status(500).json({ error: 'Failed to get market status' });
  }
};

// Get all watchlists for the user
const getWatchlists = async (req, res) => {
  try {
    res.json(watchlists);
  } catch (error) {
    console.error('Error fetching watchlists:', error);
    res.status(500).json({ error: 'Failed to fetch watchlists' });
  }
};

// Get a specific watchlist with live prices
const getWatchlist = async (req, res) => {
  try {
    const { id } = req.params;
    const watchlist = watchlists.find(w => w.id === id);
    
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    console.log('Found watchlist:', id, 'with', watchlist.instruments.length, 'instruments');

    // Always attach live prices to instruments, even if empty
    watchlist.instruments = watchlist.instruments.map(instrument => {
      const symbol = instrument.symbol || instrument.tradingsymbol || instrument.instrument_token || 'UNKNOWN';
      const priceData = getMockPrice(symbol);
      
      console.log(`Generating mock price for ${symbol}:`, priceData);
      
      const instrumentWithPrice = {
        ...instrument,
        livePrice: {
          price: Math.round(priceData.last_price * 100) / 100,
          change: Math.round(priceData.change * 100) / 100,
          changePercent: Math.round(priceData.change_percent * 100) / 100,
          volume: priceData.volume,
          timestamp: priceData.timestamp
        }
      };
      
      console.log('Instrument with price:', JSON.stringify(instrumentWithPrice, null, 2));
      return instrumentWithPrice;
    });

    console.log('Final watchlist response:', JSON.stringify(watchlist, null, 2));
    res.json(watchlist);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
};

// Create a new watchlist
const createWatchlist = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Watchlist name is required' });
    }

    const newWatchlist = {
      id: `watchlist-${Date.now()}`,
      name,
      instruments: [],
      createdAt: new Date()
    };

    watchlists.push(newWatchlist);
    res.status(201).json(newWatchlist);
  } catch (error) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({ error: 'Failed to create watchlist' });
  }
};

// Delete a watchlist
const deleteWatchlist = async (req, res) => {
  try {
    const { id } = req.params;
    const index = watchlists.findIndex(w => w.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    watchlists.splice(index, 1);
    res.json({ message: 'Watchlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    res.status(500).json({ error: 'Failed to delete watchlist' });
  }
};

// Add instrument to watchlist
const addInstrument = async (req, res) => {
  try {
    const { id } = req.params;
    const { instrument } = req.body;
    
    console.log('Adding instrument to watchlist:', id, instrument);
    
    if (!instrument) {
      return res.status(400).json({ error: 'Instrument data is required' });
    }

    const watchlist = watchlists.find(w => w.id === id);
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // Check if instrument already exists
    const exists = watchlist.instruments.some(inst => 
      inst._id === instrument._id || 
      inst.instrument_token === instrument.instrument_token
    );

    if (exists) {
      return res.status(400).json({ error: 'Instrument already in watchlist' });
    }

    // Add instrument with timestamp
    const instrumentWithMeta = {
      ...instrument,
      addedAt: new Date()
    };

    watchlist.instruments.push(instrumentWithMeta);
    console.log('Instrument added successfully. Watchlist now has:', watchlist.instruments.length, 'instruments');

    res.json(watchlist);
  } catch (error) {
    console.error('Error adding instrument:', error);
    res.status(500).json({ error: 'Failed to add instrument' });
  }
};

// Remove instrument from watchlist
const removeInstrument = async (req, res) => {
  try {
    const { id, instrumentId } = req.params;
    
    const watchlist = watchlists.find(w => w.id === id);
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const instrumentIndex = watchlist.instruments.findIndex(inst => 
      inst._id === instrumentId || inst.instrument_token === instrumentId
    );

    if (instrumentIndex === -1) {
      return res.status(404).json({ error: 'Instrument not found in watchlist' });
    }

    // Remove instrument
    watchlist.instruments.splice(instrumentIndex, 1);

    res.json(watchlist);
  } catch (error) {
    console.error('Error removing instrument:', error);
    res.status(500).json({ error: 'Failed to remove instrument' });
  }
};

// Dummy functions for Zerodha (not used in mock mode)
const initializeZerodha = async (req, res) => {
  res.json({ message: 'Mock mode - Zerodha not needed', connected: true });
};

const getZerodhaLoginUrl = async (req, res) => {
  res.json({ loginUrl: 'https://example.com/mock-login' });
};

const generateAccessToken = async (req, res) => {
  res.json({ accessToken: 'mock-token' });
};

module.exports = {
  getMarketStatus,
  getWatchlists,
  getWatchlist,
  createWatchlist,
  deleteWatchlist,
  addInstrument,
  removeInstrument,
  initializeZerodha,
  getZerodhaLoginUrl,
  generateAccessToken
};
