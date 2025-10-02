const zerodhaServiceInstance = require('../services/zerodhaServiceInstance');
const mockPriceService = require('../services/mockPriceService');

// In-memory storage for watchlists (replace with database in production)
let watchlists = [
  {
    id: 'default-watchlist',
    name: 'My Watchlist',
    instruments: [
      {
        instrument_token: 256265,
        tradingsymbol: 'RELIANCE',
        name: 'RELIANCE INDUSTRIES LTD',
        exchange: 'NSE',
        segment: 'NSE',
        instrument_type: 'EQ',
        lot_size: 1
      },
      {
        instrument_token: 738561,
        tradingsymbol: 'INFY',
        name: 'INFOSYS LTD',
        exchange: 'NSE',
        segment: 'NSE',
        instrument_type: 'EQ',
        lot_size: 1
      },
      {
        instrument_token: 779521,
        tradingsymbol: 'TCS',
        name: 'TATA CONSULTANCY SERVICES LTD',
        exchange: 'NSE',
        segment: 'NSE',
        instrument_type: 'EQ',
        lot_size: 1
      }
    ]
  }
];

/**
 * Initialize Zerodha service
 */
const initializeZerodha = async (req, res) => {
  try {
    console.log('🚀 Initializing Zerodha service...');
    
    // Force bootstrap of Zerodha service
    await zerodhaServiceInstance.bootstrap();
    
    // Get market status to verify connection
    const marketStatus = zerodhaServiceInstance.getMarketStatus();
    
    res.json({
      success: true,
      message: 'Zerodha service initialized successfully',
      data: {
        marketStatus,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error initializing Zerodha service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize Zerodha service',
      error: error.message,
      details: error.stack
    });
  }
};

/**
 * Get market status
 */
const getMarketStatus = async (req, res) => {
  try {
    const marketStatus = zerodhaServiceInstance.getMarketStatus();
    
    // Try to get profile if bootstrapped
    let profile = null;
    if (marketStatus.isBootstrapped && marketStatus.accessToken) {
      try {
        profile = await zerodhaServiceInstance.getProfile();
      } catch (profileError) {
        console.log('Profile fetch failed:', profileError.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        ...marketStatus,
        profile,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error getting market status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get market status',
      error: error.message
    });
  }
};

/**
 * Get all watchlists
 */
const getWatchlists = async (req, res) => {
  try {
    // Add live prices to all instruments in all watchlists
    const watchlistsWithPrices = await Promise.all(
      watchlists.map(async (watchlist) => {
        const instrumentsWithPrices = await getInstrumentsWithPrices(watchlist.instruments);
        return {
          ...watchlist,
          instruments: instrumentsWithPrices
        };
      })
    );
    
    res.json({
      success: true,
      data: watchlistsWithPrices,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting watchlists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get watchlists',
      error: error.message
    });
  }
};

/**
 * Create a new watchlist
 */
const createWatchlist = (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Watchlist name is required'
      });
    }
    
    const newWatchlist = {
      id: `watchlist-${Date.now()}`,
      name,
      instruments: []
    };
    
    watchlists.push(newWatchlist);
    
    res.json({
      success: true,
      message: 'Watchlist created successfully',
      data: newWatchlist
    });
    
  } catch (error) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create watchlist',
      error: error.message
    });
  }
};

/**
 * Get a specific watchlist with live prices
 */
const getWatchlist = async (req, res) => {
  try {
    const { id } = req.params;
    
    const watchlist = watchlists.find(w => w.id === id);
    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }
    
    // Add live prices to instruments
    const instrumentsWithPrices = await getInstrumentsWithPrices(watchlist.instruments);
    
    res.json({
      success: true,
      data: {
        ...watchlist,
        instruments: instrumentsWithPrices
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting watchlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get watchlist',
      error: error.message
    });
  }
};

/**
 * Helper function to get instruments with live prices
 */
const getInstrumentsWithPrices = async (instruments) => {
  if (!instruments || instruments.length === 0) {
    return [];
  }
  
  try {
    // Extract instrument tokens
    const tokens = instruments
      .map(inst => inst.instrument_token)
      .filter(token => token && !isNaN(parseInt(token)));
    
    if (tokens.length === 0) {
      // Return instruments with mock prices if no valid tokens
      return instruments.map(instrument => ({
        ...instrument,
        livePrice: mockPriceService.getPrice(instrument.tradingsymbol || instrument.symbol)
      }));
    }
    
    // Try to get live prices from Zerodha
    let livePrices = {};
    try {
      if (zerodhaServiceInstance.getMarketStatus().isBootstrapped) {
        livePrices = await zerodhaServiceInstance.getCurrentPrice(tokens);
      }
    } catch (priceError) {
      console.log('Live price fetch failed, using mock prices:', priceError.message);
    }
    
    // Combine instruments with prices
    return instruments.map(instrument => {
      const token = instrument.instrument_token;
      let livePrice = null;
      
      // Try to get live price from Zerodha first
      if (livePrices[token]) {
        livePrice = {
          last_price: livePrices[token].last_price,
          change: livePrices[token].change,
          change_percent: livePrices[token].change_percent,
          volume: livePrices[token].volume,
          timestamp: livePrices[token].timestamp,
          source: 'zerodha'
        };
      } else {
        // Fallback to mock price
        const mockPrice = mockPriceService.getPrice(instrument.tradingsymbol || instrument.symbol);
        livePrice = {
          ...mockPrice,
          source: 'mock'
        };
      }
      
      return {
        ...instrument,
        livePrice
      };
    });
    
  } catch (error) {
    console.error('Error getting instruments with prices:', error);
    
    // Fallback to mock prices
    return instruments.map(instrument => ({
      ...instrument,
      livePrice: {
        ...mockPriceService.getPrice(instrument.tradingsymbol || instrument.symbol),
        source: 'mock'
      }
    }));
  }
};

/**
 * Add instrument to watchlist
 */
const addInstrumentToWatchlist = (req, res) => {
  try {
    const { id } = req.params;
    const instrument = req.body;
    
    const watchlist = watchlists.find(w => w.id === id);
    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }
    
    // Validate instrument data
    if (!instrument.instrument_token || !instrument.tradingsymbol) {
      return res.status(400).json({
        success: false,
        message: 'Instrument token and trading symbol are required'
      });
    }
    
    // Check if instrument already exists
    const exists = watchlist.instruments.some(
      i => i.instrument_token === instrument.instrument_token
    );
    
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Instrument already exists in watchlist'
      });
    }
    
    watchlist.instruments.push(instrument);
    
    res.json({
      success: true,
      message: 'Instrument added to watchlist successfully',
      data: watchlist
    });
    
  } catch (error) {
    console.error('Error adding instrument to watchlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add instrument to watchlist',
      error: error.message
    });
  }
};

/**
 * Remove instrument from watchlist
 */
const removeInstrumentFromWatchlist = (req, res) => {
  try {
    const { id, instrumentToken } = req.params;
    
    const watchlist = watchlists.find(w => w.id === id);
    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }
    
    const initialLength = watchlist.instruments.length;
    watchlist.instruments = watchlist.instruments.filter(
      i => i.instrument_token !== parseInt(instrumentToken)
    );
    
    if (watchlist.instruments.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Instrument not found in watchlist'
      });
    }
    
    res.json({
      success: true,
      message: 'Instrument removed from watchlist successfully',
      data: watchlist
    });
    
  } catch (error) {
    console.error('Error removing instrument from watchlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove instrument from watchlist',
      error: error.message
    });
  }
};

/**
 * Delete watchlist
 */
const deleteWatchlist = (req, res) => {
  try {
    const { id } = req.params;
    
    const initialLength = watchlists.length;
    watchlists = watchlists.filter(w => w.id !== id);
    
    if (watchlists.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Watchlist deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete watchlist',
      error: error.message
    });
  }
};

/**
 * Refresh Zerodha token
 */
const refreshZerodhaToken = async (req, res) => {
  try {
    console.log('🔄 Refreshing Zerodha token...');
    
    await zerodhaServiceInstance.refreshToken();
    
    const marketStatus = zerodhaServiceInstance.getMarketStatus();
    
    res.json({
      success: true,
      message: 'Zerodha token refreshed successfully',
      data: {
        marketStatus,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error refreshing Zerodha token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh Zerodha token',
      error: error.message
    });
  }
};

/**
 * Get live prices for specific instruments
 */
const getLivePrices = async (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Instrument tokens array is required'
      });
    }
    
    const validTokens = tokens
      .map(token => parseInt(token))
      .filter(token => !isNaN(token) && token > 0);
    
    if (validTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid instrument tokens provided'
      });
    }
    
    let prices = {};
    
    try {
      if (zerodhaServiceInstance.getMarketStatus().isBootstrapped) {
        prices = await zerodhaServiceInstance.getCurrentPrice(validTokens);
      }
    } catch (priceError) {
      console.log('Live price fetch failed:', priceError.message);
    }
    
    res.json({
      success: true,
      data: prices,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting live prices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get live prices',
      error: error.message
    });
  }
};

// Export all functions
module.exports = {
  initializeZerodha,
  getMarketStatus,
  getWatchlists,
  createWatchlist,
  getWatchlist,
  addInstrumentToWatchlist,
  removeInstrumentFromWatchlist,
  deleteWatchlist,
  refreshZerodhaToken,
  getLivePrices
};
