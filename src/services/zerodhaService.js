const KiteConnect = require('kiteconnect').KiteConnect;
const KiteTicker = require('kiteconnect').KiteTicker;

class ZerodhaService {
  constructor() {
    this.apiKey = 'n9fp8kfh1lcbqnt8';
    this.apiSecret = '4j9bekkl72yo7wv8h34jtl7mhw9gnvf9';
    this.accessToken = null;
    this.kc = null;
    this.ticker = null;
    this.subscribedTokens = new Set();
    this.priceCallbacks = new Map();
    this.isMarketHours = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.livePriceCache = new Map();
    
    // Market hours: 9:15 AM to 3:30 PM IST (Monday to Friday)
    this.marketStartHour = 9;
    this.marketStartMinute = 15;
    this.marketEndHour = 15;
    this.marketEndMinute = 30;
    
    // Initialize KiteConnect
    this.kc = new KiteConnect({
      api_key: this.apiKey
    });
    
    // Check market hours every minute
    setInterval(() => {
      this.checkMarketHours();
    }, 60000);
    
    this.checkMarketHours();
  }

  /**
   * Generate login URL for Zerodha authentication
   */
  getLoginURL() {
    return this.kc.getLoginURL();
  }

  /**
   * Generate access token from request token
   */
  async generateAccessToken(requestToken) {
    try {
      const response = await this.kc.generateSession(requestToken, this.apiSecret);
      this.accessToken = response.access_token;
      this.kc.setAccessToken(this.accessToken);
      
      // Initialize ticker with access token
      this.ticker = new KiteTicker({
        api_key: this.apiKey,
        access_token: this.accessToken
      });
      
      this.setupTickerEvents();
      
      return {
        access_token: this.accessToken,
        user: response
      };
    } catch (error) {
      console.error('Error generating access token:', error);
      throw error;
    }
  }

  /**
   * Initialize with existing access token
   */
  initialize(accessToken) {
    this.accessToken = accessToken;
    this.kc.setAccessToken(accessToken);
    
    // Initialize ticker
    this.ticker = new KiteTicker({
      api_key: this.apiKey,
      access_token: this.accessToken
    });
    
    this.setupTickerEvents();
    
    // Start appropriate price service based on market hours
    if (this.isMarketHours) {
      this.connectWebSocket();
    }
    
    console.log('Zerodha service initialized with access token');
  }

  /**
   * Setup ticker event handlers
   */
  setupTickerEvents() {
    if (!this.ticker) return;

    this.ticker.on('ticks', (ticks) => {
      ticks.forEach(tick => {
        // Cache the price data
        this.livePriceCache.set(tick.instrument_token, {
          instrument_token: tick.instrument_token,
          last_price: tick.last_price,
          change: tick.change,
          change_percent: tick.change_percent || 0,
          volume: tick.volume,
          timestamp: new Date(),
          ohlc: tick.ohlc
        });
        
        // Call registered callbacks
        const callback = this.priceCallbacks.get(tick.instrument_token);
        if (callback) {
          callback(this.livePriceCache.get(tick.instrument_token));
        }
      });
    });

    this.ticker.on('connect', () => {
      console.log('Zerodha WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Subscribe to all previously subscribed tokens
      if (this.subscribedTokens.size > 0) {
        this.subscribeToTokens(Array.from(this.subscribedTokens));
      }
    });

    this.ticker.on('disconnect', () => {
      console.log('Zerodha WebSocket disconnected');
    });

    this.ticker.on('error', (error) => {
      console.error('Zerodha WebSocket error:', error);
    });

    this.ticker.on('close', () => {
      console.log('Zerodha WebSocket connection closed');
      
      // Attempt to reconnect if market is still open
      if (this.isMarketHours && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.connectWebSocket();
        }, 5000 * this.reconnectAttempts);
      }
    });
  }

  /**
   * Check if market is currently open
   */
  checkMarketHours() {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const day = istTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = istTime.getHours();
    const minute = istTime.getMinutes();
    
    // Market is closed on weekends
    if (day === 0 || day === 6) {
      this.isMarketHours = false;
      if (this.ticker && this.ticker.connected()) {
        this.disconnectWebSocket();
      }
      return;
    }
    
    // Check if current time is within market hours
    const currentMinutes = hour * 60 + minute;
    const marketStartMinutes = this.marketStartHour * 60 + this.marketStartMinute;
    const marketEndMinutes = this.marketEndHour * 60 + this.marketEndMinute;
    
    const wasMarketHours = this.isMarketHours;
    this.isMarketHours = currentMinutes >= marketStartMinutes && currentMinutes <= marketEndMinutes;
    
    // Handle market open/close transitions
    if (this.isMarketHours && !wasMarketHours) {
      console.log('Market opened - switching to WebSocket');
      this.connectWebSocket();
    } else if (!this.isMarketHours && wasMarketHours) {
      console.log('Market closed - switching to REST API');
      this.disconnectWebSocket();
    }
  }

  /**
   * Connect to Zerodha WebSocket for live price streaming
   */
  connectWebSocket() {
    if (!this.ticker || !this.accessToken) return;
    
    try {
      if (!this.ticker.connected()) {
        this.ticker.connect();
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.ticker && this.ticker.connected()) {
      this.ticker.disconnect();
    }
  }

  /**
   * Subscribe to instrument tokens for live price updates
   */
  subscribeToTokens(tokens) {
    if (!Array.isArray(tokens)) tokens = [tokens];
    
    // Convert to numbers and filter valid tokens
    const validTokens = tokens
      .map(token => parseInt(token))
      .filter(token => !isNaN(token) && token > 0);
    
    if (validTokens.length === 0) return;
    
    validTokens.forEach(token => this.subscribedTokens.add(token));
    
    if (this.ticker && this.ticker.connected()) {
      try {
        this.ticker.subscribe(validTokens);
        this.ticker.setMode(this.ticker.modeLTP, validTokens); // LTP mode for basic price data
      } catch (error) {
        console.error('Error subscribing to tokens:', error);
      }
    }
  }

  /**
   * Unsubscribe from instrument tokens
   */
  unsubscribeFromTokens(tokens) {
    if (!Array.isArray(tokens)) tokens = [tokens];
    
    const validTokens = tokens
      .map(token => parseInt(token))
      .filter(token => !isNaN(token) && token > 0);
    
    validTokens.forEach(token => this.subscribedTokens.delete(token));
    
    if (this.ticker && this.ticker.connected()) {
      try {
        this.ticker.unsubscribe(validTokens);
      } catch (error) {
        console.error('Error unsubscribing from tokens:', error);
      }
    }
  }

  /**
   * Get live price via REST API (for off-market hours)
   */
  async getLivePriceREST(instrumentTokens) {
    if (!this.accessToken) {
      throw new Error('Access token not provided');
    }
    
    try {
      const tokens = Array.isArray(instrumentTokens) ? instrumentTokens : [instrumentTokens];
      const validTokens = tokens
        .map(token => parseInt(token))
        .filter(token => !isNaN(token) && token > 0);
      
      if (validTokens.length === 0) {
        return {};
      }
      
      const quotes = await this.kc.getQuote(validTokens);
      
      // Transform the response to match our format
      const result = {};
      Object.keys(quotes).forEach(token => {
        const quote = quotes[token];
        result[token] = {
          instrument_token: parseInt(token),
          last_price: quote.last_price,
          change: quote.net_change,
          change_percent: quote.net_change ? ((quote.net_change / (quote.last_price - quote.net_change)) * 100) : 0,
          volume: quote.volume,
          timestamp: new Date(),
          ohlc: quote.ohlc
        };
      });
      
      return result;
    } catch (error) {
      console.error('Error fetching REST price:', error);
      throw error;
    }
  }

  /**
   * Get historical data
   */
  async getHistoricalData(instrumentToken, interval, fromDate, toDate) {
    if (!this.accessToken) {
      throw new Error('Access token not provided');
    }
    
    try {
      const data = await this.kc.getHistoricalData(
        parseInt(instrumentToken),
        interval,
        fromDate,
        toDate
      );
      
      return data;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile() {
    if (!this.accessToken) {
      throw new Error('Access token not provided');
    }
    
    try {
      return await this.kc.getProfile();
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  /**
   * Register callback for price updates
   */
  onPriceUpdate(instrumentToken, callback) {
    const token = parseInt(instrumentToken);
    if (isNaN(token)) return;
    
    this.priceCallbacks.set(token, callback);
    
    // Subscribe to token if not already subscribed
    if (!this.subscribedTokens.has(token)) {
      this.subscribeToTokens([token]);
    }
  }

  /**
   * Remove price update callback
   */
  removePriceCallback(instrumentToken) {
    const token = parseInt(instrumentToken);
    if (isNaN(token)) return;
    
    this.priceCallbacks.delete(token);
    this.unsubscribeFromTokens([token]);
  }

  /**
   * Get current price (automatically chooses WebSocket or REST based on market hours)
   */
  async getCurrentPrice(instrumentTokens) {
    const tokens = Array.isArray(instrumentTokens) ? instrumentTokens : [instrumentTokens];
    const validTokens = tokens
      .map(token => parseInt(token))
      .filter(token => !isNaN(token) && token > 0);
    
    if (validTokens.length === 0) {
      return {};
    }
    
    if (this.isMarketHours && this.ticker && this.ticker.connected()) {
      // During market hours, try to get cached prices from WebSocket
      const prices = {};
      let foundCached = 0;
      
      validTokens.forEach(token => {
        if (this.livePriceCache.has(token)) {
          prices[token] = this.livePriceCache.get(token);
          foundCached++;
        }
      });
      
      // If we have cached prices for all tokens, return them
      if (foundCached === validTokens.length) {
        return prices;
      }
      
      // Otherwise, subscribe and wait for updates (fallback to REST if timeout)
      try {
        this.subscribeToTokens(validTokens);
        
        // Wait a bit for WebSocket data, then fallback to REST
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check cache again
        validTokens.forEach(token => {
          if (this.livePriceCache.has(token)) {
            prices[token] = this.livePriceCache.get(token);
          }
        });
        
        if (Object.keys(prices).length > 0) {
          return prices;
        }
      } catch (error) {
        console.error('WebSocket price fetch failed, falling back to REST:', error);
      }
    }
    
    // During off-market hours or WebSocket failure, use REST API
    return await this.getLivePriceREST(validTokens);
  }

  /**
   * Get market status
   */
  getMarketStatus() {
    return {
      isOpen: this.isMarketHours,
      connectionType: this.isMarketHours ? 'WebSocket' : 'REST API',
      wsConnected: this.ticker ? this.ticker.connected() : false,
      subscribedTokens: Array.from(this.subscribedTokens),
      accessToken: !!this.accessToken,
      apiKey: this.apiKey
    };
  }

  /**
   * Get instruments list
   */
  async getInstruments(exchange = null) {
    if (!this.accessToken) {
      throw new Error('Access token not provided');
    }
    
    try {
      return await this.kc.getInstruments(exchange);
    } catch (error) {
      console.error('Error fetching instruments:', error);
      throw error;
    }
  }
}

module.exports = ZerodhaService;
