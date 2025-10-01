const express = require('express');
const router = express.Router();
const ZerodhaService = require('../services/zerodhaService');

// Initialize Zerodha service instance
const zerodhaService = new ZerodhaService();

// Get Zerodha login URL
router.get('/zerodha/login-url', (req, res) => {
  try {
    const loginUrl = zerodhaService.getLoginURL();
    res.json({ loginUrl });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate login URL', error: error.message });
  }
});

// Generate access token from request token
router.post('/zerodha/generate-token', async (req, res) => {
  try {
    const { requestToken } = req.body;
    
    if (!requestToken) {
      return res.status(400).json({ message: 'Request token is required' });
    }
    
    const tokenData = await zerodhaService.generateAccessToken(requestToken);
    res.json({
      message: 'Access token generated successfully',
      ...tokenData,
      marketStatus: zerodhaService.getMarketStatus()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to generate access token', 
      error: error.message 
    });
  }
});

// Initialize Zerodha with existing access token
router.post('/zerodha/initialize', (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ message: 'Access token is required' });
    }
    
    zerodhaService.initialize(accessToken);
    
    res.json({
      message: 'Zerodha API initialized successfully',
      marketStatus: zerodhaService.getMarketStatus()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to initialize Zerodha API', 
      error: error.message 
    });
  }
});

// Get market status
router.get('/market-status', (req, res) => {
  try {
    const status = zerodhaService.getMarketStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get market status', 
      error: error.message 
    });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const profile = await zerodhaService.getProfile();
    res.json(profile);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get user profile', 
      error: error.message 
    });
  }
});

// Get live prices
router.get('/prices/live', async (req, res) => {
  try {
    const { tokens } = req.query;
    
    if (!tokens) {
      return res.status(400).json({ message: 'Instrument tokens are required' });
    }
    
    const tokenList = tokens.split(',').map(t => t.trim()).filter(t => t);
    const prices = await zerodhaService.getCurrentPrice(tokenList);
    
    res.json(prices);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get live prices', 
      error: error.message 
    });
  }
});

// Get historical data
router.get('/prices/historical/:instrumentToken', async (req, res) => {
  try {
    const { instrumentToken } = req.params;
    const { interval, from, to } = req.query;
    
    if (!interval || !from || !to) {
      return res.status(400).json({
        message: 'Interval, from date, and to date are required'
      });
    }
    
    const data = await zerodhaService.getHistoricalData(instrumentToken, interval, from, to);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get historical data', 
      error: error.message 
    });
  }
});

// Subscribe to live price updates
router.post('/subscribe', (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens || !Array.isArray(tokens)) {
      return res.status(400).json({ message: 'Tokens array is required' });
    }
    
    zerodhaService.subscribeToTokens(tokens);
    res.json({ 
      message: 'Subscribed to price updates',
      tokens: tokens,
      marketStatus: zerodhaService.getMarketStatus()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to subscribe to price updates', 
      error: error.message 
    });
  }
});

// Unsubscribe from live price updates
router.post('/unsubscribe', (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens || !Array.isArray(tokens)) {
      return res.status(400).json({ message: 'Tokens array is required' });
    }
    
    zerodhaService.unsubscribeFromTokens(tokens);
    res.json({ 
      message: 'Unsubscribed from price updates',
      tokens: tokens 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to unsubscribe from price updates', 
      error: error.message 
    });
  }
});

// Get Zerodha instruments
router.get('/instruments/:exchange?', async (req, res) => {
  try {
    const { exchange } = req.params;
    const instruments = await zerodhaService.getInstruments(exchange);
    res.json(instruments);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get instruments', 
      error: error.message 
    });
  }
});

// Basic watchlist endpoints (using simple in-memory storage for demo)
let watchlists = [
  {
    id: 'demo-watchlist-1',
    name: 'My Watchlist',
    instruments: [],
    createdAt: new Date().toISOString()
  }
];

router.get('/', (req, res) => {
  res.json(watchlists);
});

router.post('/', (req, res) => {
  const { name, instruments = [] } = req.body;
  
  const newWatchlist = {
    id: 'watchlist-' + Date.now(),
    name: name || 'New Watchlist',
    instruments: instruments,
    createdAt: new Date().toISOString()
  };
  
  watchlists.push(newWatchlist);
  res.status(201).json(newWatchlist);
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const watchlist = watchlists.find(w => w.id === id);
    
    if (!watchlist) {
      return res.status(404).json({ message: 'Watchlist not found' });
    }
    
    // Get live prices for instruments in watchlist
    if (watchlist.instruments.length > 0) {
      const tokens = watchlist.instruments
        .map(inst => inst.instrument_token)
        .filter(token => token);
      
      if (tokens.length > 0) {
        try {
          const livePrices = await zerodhaService.getCurrentPrice(tokens);
          
          // Merge live prices with instruments
          watchlist.instruments = watchlist.instruments.map(inst => ({
            ...inst,
            livePrice: livePrices[inst.instrument_token] || null
          }));
        } catch (error) {
          console.error('Failed to get live prices:', error);
        }
      }
    }
    
    res.json(watchlist);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get watchlist', 
      error: error.message 
    });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = watchlists.findIndex(w => w.id === id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Watchlist not found' });
  }
  
  watchlists.splice(index, 1);
  res.json({ message: 'Watchlist deleted successfully' });
});

router.post('/:id/instruments', (req, res) => {
  const { id } = req.params;
  const { instrument } = req.body;
  
  const watchlist = watchlists.find(w => w.id === id);
  if (!watchlist) {
    return res.status(404).json({ message: 'Watchlist not found' });
  }
  
  // Check if instrument already exists
  const exists = watchlist.instruments.some(
    inst => inst.instrument_token === instrument.instrument_token
  );
  
  if (exists) {
    return res.status(400).json({ message: 'Instrument already in watchlist' });
  }
  
  watchlist.instruments.push({
    ...instrument,
    addedAt: new Date().toISOString()
  });
  
  // Subscribe to live prices for this instrument
  if (instrument.instrument_token) {
    zerodhaService.subscribeToTokens([instrument.instrument_token]);
  }
  
  res.json(watchlist);
});

router.delete('/:id/instruments/:instrumentToken', (req, res) => {
  const { id, instrumentToken } = req.params;
  
  const watchlist = watchlists.find(w => w.id === id);
  if (!watchlist) {
    return res.status(404).json({ message: 'Watchlist not found' });
  }
  
  const index = watchlist.instruments.findIndex(
    inst => inst.instrument_token === instrumentToken
  );
  
  if (index === -1) {
    return res.status(404).json({ message: 'Instrument not found in watchlist' });
  }
  
  watchlist.instruments.splice(index, 1);
  
  // Unsubscribe from live prices
  zerodhaService.unsubscribeFromTokens([instrumentToken]);
  
  res.json(watchlist);
});

module.exports = router;
