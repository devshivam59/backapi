const { KiteConnect, KiteTicker } = require("kiteconnect");
const fs = require("fs");
const path = require("path");

class ZerodhaService {
  constructor() {
    this.apiKey = process.env.API_KEY;
    this.apiSecret = process.env.API_SECRET;
    this.accessToken = null;
    this.kc = null;
    this.ticker = null;
    this.isBootstrapped = false;
    this.isMarketHours = false;
    this.subscribedTokens = new Set();
    this.livePriceCache = new Map();
    this.priceCallbacks = new Map();
    this.tokenFilePath = path.join(process.cwd(), 'kite_token.json');
    
    // Initialize market hours check
    this.updateMarketHours();
    setInterval(() => this.updateMarketHours(), 60000); // Check every minute
  }

  /**
   * Load access token from file
   */
  loadAccessToken() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const tokenData = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf8'));
        
        // Check if token is still valid (tokens expire daily)
        const tokenAge = new Date() - new Date(tokenData.generated_at || tokenData.login_time);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (tokenAge < maxAge && tokenData.access_token) {
          this.accessToken = tokenData.access_token;
          console.log('✅ Access token loaded from file');
          console.log('Token age:', Math.round(tokenAge / (60 * 60 * 1000)), 'hours');
          return true;
        } else {
          console.log('⚠️ Access token expired, need to regenerate');
          return false;
        }
      } else {
        console.log('⚠️ Token file not found:', this.tokenFilePath);
        return false;
      }
    } catch (error) {
      console.error('Error loading access token:', error);
      return false;
    }
  }

  /**
   * Generate new access token using auto-login
   */
  async generateAccessToken() {
    try {
      console.log('🔄 Generating new access token...');
      
      // Import and run the auto-login module
      const { authenticateKite } = require('../../auto-login.cjs');
      const sessionData = await authenticateKite();
      
      if (sessionData && sessionData.access_token) {
        this.accessToken = sessionData.access_token;
        console.log('✅ New access token generated successfully');
        return true;
      } else {
        throw new Error('Failed to generate access token');
      }
    } catch (error) {
      console.error('❌ Error generating access token:', error);
      throw error;
    }
  }

  /**
   * Initialize KiteConnect with access token
   */
  async bootstrap() {
    if (this.isBootstrapped && this.accessToken) {
      return;
    }

    try {
      console.log('🚀 Bootstrapping Zerodha service...');
      
      // Try to load existing token first
      let tokenLoaded = this.loadAccessToken();
      
      // If token loading failed, generate new one
      if (!tokenLoaded) {
        await this.generateAccessToken();
      }

      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      // Initialize KiteConnect
      this.kc = new KiteConnect({
        api_key: this.apiKey,
        access_token: this.accessToken
      });

      // Test the connection
      try {
        const profile = await this.kc.getProfile();
        console.log('✅ KiteConnect initialized successfully');
        console.log('User:', profile.user_name, '('+profile.user_id+')');
      } catch (testError) {
        console.log('❌ Token test failed, regenerating...');
        await this.generateAccessToken();
        
        this.kc = new KiteConnect({
          api_key: this.apiKey,
          access_token: this.accessToken
        });
        
        const profile = await this.kc.getProfile();
        console.log('✅ KiteConnect initialized with new token');
        console.log('User:', profile.user_name, '('+profile.user_id+')');
      }

      // Initialize WebSocket ticker for live data
      this.initializeTicker();
      
      this.isBootstrapped = true;
      console.log('🎉 Zerodha service bootstrap completed');
      
    } catch (error) {
      console.error('❌ Bootstrap failed:', error);
      this.isBootstrapped = false;
      throw error;
    }
  }

  /**
   * Initialize WebSocket ticker
   */
  initializeTicker() {
    if (!this.accessToken) return;

    try {
      this.ticker = new KiteTicker({
        api_key: this.apiKey,
        access_token: this.accessToken
      });

      this.ticker.on('ticks', (ticks) => {
        ticks.forEach((tick) => {
          const token = tick.instrument_token;
          
          // Update cache
          this.livePriceCache.set(token, {
            instrument_token: token,
            last_price: tick.last_price,
            change: tick.change,
            change_percent: tick.change ? ((tick.change / (tick.last_price - tick.change)) * 100) : 0,
            volume: tick.volume,
            timestamp: new Date(),
            ohlc: tick.ohlc || {}
          });

          // Call registered callbacks
          const callback = this.priceCallbacks.get(token);
          if (callback) {
            callback(this.livePriceCache.get(token));
          }
        });
      });

      this.ticker.on('connect', () => {
        console.log('📡 WebSocket ticker connected');
      });

      this.ticker.on('disconnect', () => {
        console.log('📡 WebSocket ticker disconnected');
      });

      this.ticker.on('error', (error) => {
        console.error('WebSocket ticker error:', error);
      });

      // Connect during market hours
      if (this.isMarketHours) {
        this.ticker.connect();
      }

    } catch (error) {
      console.error('Error initializing ticker:', error);
    }
  }

  /**
   * Update market hours status
   */
  updateMarketHours() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    // Market hours: Monday to Friday, 9:15 AM to 3:30 PM IST
    const marketStart = 9 * 60 + 15; // 9:15 AM
    const marketEnd = 15 * 60 + 30;  // 3:30 PM

    const wasMarketHours = this.isMarketHours;
    this.isMarketHours = (day >= 1 && day <= 5) && (currentTime >= marketStart && currentTime <= marketEnd);

    // Connect/disconnect ticker based on market hours
    if (this.ticker) {
      if (this.isMarketHours && !wasMarketHours) {
        console.log('📈 Market opened, connecting WebSocket ticker');
        this.ticker.connect();
      } else if (!this.isMarketHours && wasMarketHours) {
        console.log('📉 Market closed, disconnecting WebSocket ticker');
        this.ticker.disconnect();
      }
    }
  }

  /**
   * Ensure bootstrap is complete
   */
  async ensureBootstrapComplete() {
    if (!this.isBootstrapped) {
      await this.bootstrap();
    }
  }

  /**
   * Subscribe to instrument tokens for live data
   */
  subscribeToTokens(tokens) {
    if (!this.ticker || !this.ticker.connected()) return;

    const validTokens = tokens
      .map(token => parseInt(token))
      .filter(token => !isNaN(token) && token > 0);

    if (validTokens.length === 0) return;

    try {
      this.ticker.subscribe(validTokens);
      this.ticker.setMode(this.ticker.modeLTP, validTokens);
      
      validTokens.forEach(token => this.subscribedTokens.add(token));
      console.log('📊 Subscribed to tokens:', validTokens);
    } catch (error) {
      console.error('Error subscribing to tokens:', error);
    }
  }

  /**
   * Unsubscribe from instrument tokens
   */
  unsubscribeFromTokens(tokens) {
    if (!this.ticker || !this.ticker.connected()) return;

    const validTokens = tokens
      .map(token => parseInt(token))
      .filter(token => !isNaN(token) && token > 0);

    if (validTokens.length === 0) return;

    try {
      this.ticker.unsubscribe(validTokens);
      validTokens.forEach(token => {
        this.subscribedTokens.delete(token);
        this.livePriceCache.delete(token);
      });
      console.log('📊 Unsubscribed from tokens:', validTokens);
    } catch (error) {
      console.error('Error unsubscribing from tokens:', error);
    }
  }

  /**
   * Get live prices using REST API (fallback)
   */
  async getLivePriceREST(instrumentTokens) {
    await this.ensureBootstrapComplete();
    
    if (!this.accessToken) {
      throw new Error('Access token not available');
    }

    const tokens = Array.isArray(instrumentTokens) ? instrumentTokens : [instrumentTokens];
    const validTokens = tokens
      .map(token => parseInt(token))
      .filter(token => !isNaN(token) && token > 0);

    if (validTokens.length === 0) {
      return {};
    }

    try {
      const quotes = await this.kc.getQuote(validTokens);
      const result = {};
      
      Object.values(quotes).forEach((quote) => {
        const token = quote.instrument_token;
        result[token] = {
          instrument_token: token,
          last_price: quote.last_price,
          change: quote.net_change || 0,
          change_percent: quote.net_change ? (((quote.net_change) / (quote.last_price - quote.net_change)) * 100) : 0,
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
   * Get current price (automatically chooses WebSocket or REST based on market hours)
   */
  async getCurrentPrice(instrumentTokens) {
    await this.ensureBootstrapComplete();
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
    const restPrices = await this.getLivePriceREST(validTokens);
    
    // Update cache and callbacks to keep consumers consistent
    Object.values(restPrices).forEach((price) => {
      const token = parseInt(price.instrument_token);
      if (Number.isNaN(token)) return;
      
      this.livePriceCache.set(token, price);
      const callback = this.priceCallbacks.get(token);
      if (callback) {
        callback(price);
      }
    });
    
    return restPrices;
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
   * Get market status
   */
  getMarketStatus() {
    return {
      isOpen: this.isMarketHours,
      connectionType: this.isMarketHours ? 'WebSocket' : 'REST API',
      wsConnected: this.ticker ? this.ticker.connected() : false,
      subscribedTokens: Array.from(this.subscribedTokens),
      accessToken: !!this.accessToken,
      apiKey: this.apiKey,
      isBootstrapped: this.isBootstrapped
    };
  }

  /**
   * Get user profile
   */
  async getProfile() {
    await this.ensureBootstrapComplete();
    
    if (!this.accessToken) {
      throw new Error('Access token not available');
    }

    try {
      return await this.kc.getProfile();
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  /**
   * Get instruments list
   */
  async getInstruments(exchange = null) {
    await this.ensureBootstrapComplete();
    
    if (!this.accessToken) {
      throw new Error('Access token not available');
    }

    try {
      return await this.kc.getInstruments(exchange);
    } catch (error) {
      console.error('Error fetching instruments:', error);
      throw error;
    }
  }

  /**
   * Get historical data
   */
  async getHistoricalData(instrumentToken, interval, fromDate, toDate) {
    await this.ensureBootstrapComplete();
    
    if (!this.accessToken) {
      throw new Error('Access token not available');
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
   * Force token refresh
   */
  async refreshToken() {
    console.log('🔄 Forcing token refresh...');
    this.accessToken = null;
    this.isBootstrapped = false;
    
    // Disconnect ticker
    if (this.ticker && this.ticker.connected()) {
      this.ticker.disconnect();
    }
    
    // Clear caches
    this.livePriceCache.clear();
    this.subscribedTokens.clear();
    
    // Bootstrap again
    await this.bootstrap();
  }
}

module.exports = ZerodhaService;
