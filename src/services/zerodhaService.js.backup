const KiteConnect = require('kiteconnect').KiteConnect;
const KiteTicker = require('kiteconnect').KiteTicker;

const ZerodhaCredential = require('../models/ZerodhaCredential');

class ZerodhaService {
  constructor() {
    this.apiKey = null;
    this.apiSecret = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.requestToken = null;
    this.kc = null;
    this.ticker = null;
    this.subscribedTokens = new Set();
    this.priceCallbacks = new Map();
    this.isMarketHours = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.livePriceCache = new Map();
    this.restPollingInterval = null;
    this.restPollingIntervalMs = 60 * 1000;
    this.isRestPollingInFlight = false;
    this.refreshTimeout = null;
    this.nextScheduledRefreshAt = null;
    this.tickerEventsBound = false;
    this.credentialRecord = null;
    this.bootstrapPromise = this.loadPersistedCredentials();

    // Market hours: 9:15 AM to 3:30 PM IST (Monday to Friday)
    this.marketStartHour = 9;
    this.marketStartMinute = 15;
    this.marketEndHour = 15;
    this.marketEndMinute = 30;

    // Check market hours every minute
    setInterval(() => {
      this.checkMarketHours();
    }, 60000);

    this.checkMarketHours();
  }

  async updateCredentials({ apiKey, apiSecret }) {
    await this.ensureBootstrapComplete();

    if (!apiKey || !apiSecret) {
      throw new Error('API key and API secret are required');
    }

    if (this.ticker && this.ticker.connected()) {
      this.disconnectWebSocket();
    }
    this.stopRestPolling();

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accessToken = null;
    this.refreshToken = null;
    this.requestToken = null;
    this.livePriceCache.clear();
    this.subscribedTokens.clear();
    this.priceCallbacks.clear();
    this.ticker = null;
    this.tickerEventsBound = false;

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    this.nextScheduledRefreshAt = null;

    this.kc = new KiteConnect({
      api_key: this.apiKey
    });

    await this.persistCredentialState({
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      requestToken: null,
      accessToken: null,
      refreshToken: null,
      lastRequestTokenAt: null,
      lastAccessTokenGeneratedAt: null
    });

    return {
      message: 'Zerodha API credentials updated successfully'
    };
  }

  async persistCredentialState(updates = {}) {
    await this.ensureBootstrapComplete();

    const doc = this.credentialRecord || new ZerodhaCredential();

    const fields = {
      apiKey: updates.apiKey !== undefined ? updates.apiKey : this.apiKey,
      apiSecret: updates.apiSecret !== undefined ? updates.apiSecret : this.apiSecret,
      requestToken: updates.requestToken !== undefined ? updates.requestToken : this.requestToken,
      accessToken: updates.accessToken !== undefined ? updates.accessToken : this.accessToken,
      refreshToken: updates.refreshToken !== undefined ? updates.refreshToken : this.refreshToken,
      lastRequestTokenAt: updates.lastRequestTokenAt !== undefined ? updates.lastRequestTokenAt : (this.credentialRecord ? this.credentialRecord.lastRequestTokenAt : null),
      lastAccessTokenGeneratedAt: updates.lastAccessTokenGeneratedAt !== undefined ? updates.lastAccessTokenGeneratedAt : (this.credentialRecord ? this.credentialRecord.lastAccessTokenGeneratedAt : null)
    };

    Object.entries(fields).forEach(([key, value]) => {
      doc[key] = value === undefined ? null : value;
    });

    this.credentialRecord = await doc.save();
    this.applyCredentialRecord(this.credentialRecord);
  }

  async refreshAccessToken({ reason = 'manual' } = {}) {
    await this.ensureBootstrapComplete();

    if (!this.refreshToken) {
      const error = new Error('Refresh token is not available. Generate a new access token using a request token.');
      error.status = 400;
      throw error;
    }

    if (!this.apiKey || !this.apiSecret) {
      const error = new Error('Zerodha API credentials are not configured');
      error.status = 400;
      throw error;
    }

    if (!this.kc) {
      this.kc = new KiteConnect({
        api_key: this.apiKey
      });
    }

    const response = await this.kc.renewAccessToken(this.refreshToken, this.apiSecret);

    this.accessToken = response.access_token;
    if (response.refresh_token) {
      this.refreshToken = response.refresh_token;
    }

    this.kc.setAccessToken(this.accessToken);

    if (this.ticker && this.ticker.connected()) {
      this.disconnectWebSocket();
    }

    this.ticker = new KiteTicker({
      api_key: this.apiKey,
      access_token: this.accessToken
    });

    this.tickerEventsBound = false;
    this.setupTickerEvents();

    if (this.isMarketHours) {
      this.connectWebSocket();
    } else {
      this.startRestPolling();
    }

    await this.persistCredentialState({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      lastAccessTokenGeneratedAt: new Date()
    });

    this.scheduleAutoRefresh();

    return {
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      reason
    };
  }

  async getCredentialStatus() {
    await this.ensureBootstrapComplete();

    const record = this.credentialRecord;

    const nextScheduledRefresh = this.nextScheduledRefreshAt
      ? new Date(this.nextScheduledRefreshAt)
      : null;

    return {
      apiKeyConfigured: Boolean(this.apiKey),
      accessTokenAvailable: Boolean(this.accessToken),
      refreshTokenAvailable: Boolean(this.refreshToken),
      lastRequestTokenAt: record ? record.lastRequestTokenAt : null,
      lastAccessTokenGeneratedAt: record ? record.lastAccessTokenGeneratedAt : null,
      nextScheduledRefresh
    };
  }

  async loadPersistedCredentials() {
    try {
      const credential = await ZerodhaCredential.findOne().sort({ updatedAt: -1 });
      if (!credential) {
        return;
      }

      this.applyCredentialRecord(credential);

      if (this.accessToken) {
        this.initialize(this.accessToken, { skipPersistence: true });
      }

      this.scheduleAutoRefresh();
    } catch (error) {
      console.error('Failed to load Zerodha credentials:', error);
    }
  }

  applyCredentialRecord(credential) {
    this.credentialRecord = credential;
    this.apiKey = credential.apiKey;
    this.apiSecret = credential.apiSecret;
    this.requestToken = credential.requestToken;
    this.accessToken = credential.accessToken;
    this.refreshToken = credential.refreshToken;

    if (this.apiKey) {
      this.kc = new KiteConnect({
        api_key: this.apiKey
      });
      if (this.accessToken) {
        this.kc.setAccessToken(this.accessToken);
      }
    }
  }

  async ensureBootstrapComplete() {
    if (this.bootstrapPromise) {
      await this.bootstrapPromise;
      this.bootstrapPromise = null;
    }
  }

  scheduleAutoRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    if (!this.apiKey || !this.apiSecret || !this.refreshToken) {
      this.nextScheduledRefreshAt = null;
      return;
    }

    const now = new Date();
    const nextRun = this.calculateNextRefreshTime(now);
    const delay = Math.max(nextRun.getTime() - now.getTime(), 0);

    this.nextScheduledRefreshAt = nextRun;

    this.refreshTimeout = setTimeout(async () => {
      this.refreshTimeout = null;
      try {
        await this.refreshAccessToken({ reason: 'scheduled' });
      } catch (error) {
        console.error('Scheduled Zerodha access token refresh failed:', error);
        // Reschedule even after failure to avoid being stuck
        this.scheduleAutoRefresh();
      }
    }, delay);
  }

  calculateNextRefreshTime(fromDate = new Date()) {
    const istDate = new Date(fromDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const next = new Date(istDate);
    next.setHours(8, 30, 0, 0);

    if (next <= istDate) {
      next.setDate(next.getDate() + 1);
    }

    // Convert back to server timezone
    const offsetDifference = istDate.getTime() - fromDate.getTime();
    return new Date(next.getTime() - offsetDifference);
  }

  /**
   * Generate login URL for Zerodha authentication
   */
  async getLoginURL() {
    await this.ensureBootstrapComplete();

    if (!this.apiKey) {
      const error = new Error('Zerodha API credentials are not configured');
      error.status = 400;
      throw error;
    }

    if (!this.kc) {
      this.kc = new KiteConnect({
        api_key: this.apiKey
      });
    }

    return this.kc.getLoginURL();
  }

  /**
   * Generate access token from request token
   */
  async generateAccessToken(requestToken) {
    await this.ensureBootstrapComplete();

    if (!this.apiKey || !this.apiSecret) {
      const error = new Error('Zerodha API credentials are not configured');
      error.status = 400;
      throw error;
    }

    try {
      if (!this.kc) {
        this.kc = new KiteConnect({
          api_key: this.apiKey
        });
      }
      const response = await this.kc.generateSession(requestToken, this.apiSecret);
      this.accessToken = response.access_token;
      this.refreshToken = response.refresh_token;
      this.requestToken = requestToken;
      this.kc.setAccessToken(this.accessToken);

      // Initialize ticker with access token
      this.ticker = new KiteTicker({
        api_key: this.apiKey,
        access_token: this.accessToken
      });

      this.tickerEventsBound = false;
      this.setupTickerEvents();

      // Immediately establish a WebSocket connection when market is open
      // so that live ticks start flowing without waiting for the next
      // scheduled market-hours check.
      if (this.isMarketHours) {
        this.connectWebSocket();
      } else {
        this.startRestPolling();
      }

      await this.persistCredentialState({
        requestToken,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        lastRequestTokenAt: new Date(),
        lastAccessTokenGeneratedAt: new Date()
      });

      this.scheduleAutoRefresh();

      return {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
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
  initialize(accessToken, options = {}) {
    if (!this.apiKey) {
      throw new Error('Zerodha API key is not configured');
    }

    if (!this.kc) {
      this.kc = new KiteConnect({
        api_key: this.apiKey
      });
    }

    this.accessToken = accessToken;
    this.kc.setAccessToken(accessToken);

    // Initialize ticker
    this.ticker = new KiteTicker({
      api_key: this.apiKey,
      access_token: this.accessToken
    });

    this.tickerEventsBound = false;
    this.setupTickerEvents();

    // Start appropriate price service based on market hours
    if (this.isMarketHours) {
      this.connectWebSocket();
    } else {
      this.startRestPolling();
    }

    if (!options.skipPersistence) {
      this.persistCredentialState({
        accessToken: this.accessToken
      }).catch((error) => {
        console.error('Failed to persist Zerodha initialization state:', error);
      });
    }

    console.log('Zerodha service initialized with access token');
  }

  /**
   * Setup ticker event handlers
   */
  setupTickerEvents() {
    if (!this.ticker || this.tickerEventsBound) return;

    this.tickerEventsBound = true;

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
      this.tickerEventsBound = false;
    });

    this.ticker.on('error', (error) => {
      console.error('Zerodha WebSocket error:', error);
    });

    this.ticker.on('close', () => {
      console.log('Zerodha WebSocket connection closed');
      this.tickerEventsBound = false;

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
      const wasMarketHours = this.isMarketHours;
      this.isMarketHours = false;
      if (this.ticker && this.ticker.connected()) {
        this.disconnectWebSocket();
      }
      if (wasMarketHours || !this.restPollingInterval) {
        this.startRestPolling();
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
      this.stopRestPolling();
      this.connectWebSocket();
    } else if (!this.isMarketHours && wasMarketHours) {
      console.log('Market closed - switching to REST API');
      this.disconnectWebSocket();
      this.startRestPolling();
    }
  }

  /**
   * Connect to Zerodha WebSocket for live price streaming
   */
  connectWebSocket() {
    if (!this.ticker || !this.accessToken) return;

    try {
      this.stopRestPolling();
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
    this.tickerEventsBound = false;
  }

  /**
   * Start polling live prices via REST when market is closed
   */
  startRestPolling() {
    if (this.isMarketHours) return;
    if (!this.accessToken) return;
    if (this.restPollingInterval) return;
    if (this.subscribedTokens.size === 0) return;

    const executePoll = () => {
      this.pollRestPrices().catch((error) => {
        console.error('REST polling failed:', error);
      });
    };

    executePoll();
    this.restPollingInterval = setInterval(executePoll, this.restPollingIntervalMs);
  }

  /**
   * Stop REST polling when WebSocket streaming resumes
   */
  stopRestPolling() {
    if (this.restPollingInterval) {
      clearInterval(this.restPollingInterval);
      this.restPollingInterval = null;
    }
    this.isRestPollingInFlight = false;
  }

  /**
   * Poll Zerodha REST API for subscribed tokens and update cache/callbacks
   */
  async pollRestPrices() {
    await this.ensureBootstrapComplete();
    if (this.isMarketHours) return;
    if (!this.accessToken) return;
    if (this.isRestPollingInFlight) return;

    const tokens = Array.from(this.subscribedTokens);
    if (tokens.length === 0) {
      return;
    }

    this.isRestPollingInFlight = true;
    try {
      const prices = await this.getLivePriceREST(tokens);
      Object.values(prices).forEach((price) => {
        const token = parseInt(price.instrument_token);
        if (Number.isNaN(token)) return;

        this.livePriceCache.set(token, price);
        const callback = this.priceCallbacks.get(token);
        if (callback) {
          callback(price);
        }
      });
    } catch (error) {
      console.error('Error polling REST prices:', error);
    } finally {
      this.isRestPollingInFlight = false;
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
    } else if (!this.isMarketHours) {
      this.startRestPolling();
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

    if (!this.isMarketHours && this.subscribedTokens.size === 0) {
      this.stopRestPolling();
    }
  }

  /**
   * Get live price via REST API (for off-market hours)
   */
  async getLivePriceREST(instrumentTokens) {
    await this.ensureBootstrapComplete();
    if (!this.accessToken) {
      const error = new Error('Access token not provided');
      error.status = 400;
      throw error;
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
    await this.ensureBootstrapComplete();
    if (!this.accessToken) {
      const error = new Error('Access token not provided');
      error.status = 400;
      throw error;
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
    await this.ensureBootstrapComplete();
    if (!this.accessToken) {
      const error = new Error('Access token not provided');
      error.status = 400;
      throw error;
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
    await this.ensureBootstrapComplete();
    if (!this.accessToken) {
      const error = new Error('Access token not provided');
      error.status = 400;
      throw error;
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
