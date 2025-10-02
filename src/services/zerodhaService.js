const { KiteConnect, KiteTicker } = require('kiteconnect');
const fs = require('fs');
const path = require('path');

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
    this.credentialsFilePath = path.join(process.cwd(), 'kite_credentials.json');
    this.lastTokenData = null;
    this.lastProfile = null;

    // Initialize market hours check
    this.updateMarketHours();
    setInterval(() => this.updateMarketHours(), 60000); // Check every minute

    // Load persisted credentials if available
    this.loadCredentials();
  }

  /**
   * Persist Zerodha credentials locally
   */
  saveCredentials() {
    try {
      const payload = {
        apiKey: this.apiKey || null,
        apiSecret: this.apiSecret || null,
        updated_at: new Date().toISOString()
      };

      fs.writeFileSync(this.credentialsFilePath, JSON.stringify(payload, null, 2));
      console.log('💾 Zerodha credentials saved to', this.credentialsFilePath);
      return true;
    } catch (error) {
      console.error('❌ Failed to save credentials:', error);
      return false;
    }
  }

  /**
   * Load Zerodha credentials from disk
   */
  loadCredentials() {
    try {
      if (!fs.existsSync(this.credentialsFilePath)) {
        return false;
      }

      const data = JSON.parse(fs.readFileSync(this.credentialsFilePath, 'utf8'));

      if (data.apiKey) {
        this.apiKey = data.apiKey;
        process.env.API_KEY = data.apiKey;
      }

      if (data.apiSecret) {
        this.apiSecret = data.apiSecret;
        process.env.API_SECRET = data.apiSecret;
      }

      console.log('🔐 Zerodha credentials loaded from file');
      return true;
    } catch (error) {
      console.error('❌ Failed to load credentials:', error);
      return false;
    }
  }

  /**
   * Load access token from file
   */
  loadAccessToken() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const tokenData = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf8'));

        this.lastTokenData = tokenData;

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
          this.accessToken = null;
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
   * Persist the latest access token details to disk
   */
  persistToken(sessionData = {}, source = 'unknown') {
    if (!sessionData && !this.accessToken) {
      throw new Error('No token data available to persist');
    }

    const nowIso = new Date().toISOString();
    const baseData = this.lastTokenData || {};

    const payload = {
      access_token: sessionData.access_token || this.accessToken || baseData.access_token || null,
      refresh_token: sessionData.refresh_token || baseData.refresh_token || null,
      user_id: sessionData.user_id || baseData.user_id || null,
      user_name: sessionData.user_name || baseData.user_name || null,
      user_shortname: sessionData.user_shortname || baseData.user_shortname || null,
      avatar_url: sessionData.avatar_url || baseData.avatar_url || null,
      user_type: sessionData.user_type || baseData.user_type || null,
      email: sessionData.email || baseData.email || null,
      public_token: sessionData.public_token || baseData.public_token || null,
      api_key: sessionData.api_key || this.apiKey || baseData.api_key || null,
      login_time: sessionData.login_time || baseData.login_time || nowIso,
      generated_at: sessionData.generated_at || baseData.generated_at || nowIso,
      source: sessionData.source || source
    };

    fs.writeFileSync(this.tokenFilePath, JSON.stringify(payload, null, 2));
    this.lastTokenData = payload;

    console.log('💾 Access token persisted to', this.tokenFilePath);

    return payload;
  }

  /**
   * Generate new access token using auto-login
   */
  async generateAccessToken(requestToken = null, options = {}) {
    try {
      console.log('🔄 Generating new access token...');

      let sessionData;
      const { skipBootstrap = false } = options;

      // Import the auto-login helpers lazily to avoid circular deps during require
      const autoLoginModule = require('../../auto-login.cjs');

      if (requestToken) {
        if (!autoLoginModule.exchangeAndSave) {
          throw new Error('exchangeAndSave helper is not available');
        }
        sessionData = await autoLoginModule.exchangeAndSave(requestToken);
      } else {
        if (!autoLoginModule.authenticateKite) {
          throw new Error('authenticateKite helper is not available');
        }
        sessionData = await autoLoginModule.authenticateKite();
      }

      if (sessionData && sessionData.access_token) {
        this.accessToken = sessionData.access_token;
        const persisted = this.persistToken(sessionData, requestToken ? 'manual-exchange' : 'auto-login');
        this.lastTokenData = persisted;
        this.isBootstrapped = false;

        // Persist token for reuse
        if (sessionData.generated_at || sessionData.login_time) {
          console.log('🕒 Token timestamp:', sessionData.generated_at || sessionData.login_time);
        }

        if (!skipBootstrap) {
          await this.setupKiteConnect();
        }

        console.log('✅ New access token generated successfully');
        return {
          ...sessionData,
          source: this.lastTokenData?.source || (requestToken ? 'manual-exchange' : 'auto-login')
        };
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
  async bootstrap({ force = false } = {}) {
    if (this.isBootstrapped && this.accessToken && !force) {
      return;
    }

    try {
      console.log('🚀 Bootstrapping Zerodha service...');

      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Zerodha API credentials are not configured. Set API_KEY and API_SECRET.');
      }

      // Try to load existing token first
      let tokenLoaded = this.loadAccessToken();

      // If token loading failed, generate new one
      if (!tokenLoaded) {
        await this.generateAccessToken(null, { skipBootstrap: true });
      }

      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      await this.setupKiteConnect();

      console.log('🎉 Zerodha service bootstrap completed');

    } catch (error) {
      console.error('❌ Bootstrap failed:', error);
      this.isBootstrapped = false;
      throw error;
    }
  }

  /**
   * Initialize KiteConnect client and ticker using the current token
   */
  async setupKiteConnect(options = {}) {
    const { forceTickerConnect = false, allowAutoRegeneration = true } = options;

    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // Disconnect any existing ticker before re-initializing
    if (this.ticker && this.ticker.connected && this.ticker.connected()) {
      this.ticker.disconnect();
    }

    this.kc = new KiteConnect({
      api_key: this.apiKey,
      access_token: this.accessToken
    });

    let profile;

    // Test the connection to ensure token validity
    try {
      profile = await this.kc.getProfile();
      console.log('✅ KiteConnect initialized successfully');
      console.log('User:', profile.user_name, '(' + profile.user_id + ')');
    } catch (testError) {
      console.log('❌ Token validation failed:', testError.message);

      if (!allowAutoRegeneration) {
        this.kc = null;
        this.isBootstrapped = false;
        this.lastProfile = null;
        throw new Error(`Access token validation failed: ${testError.message}`);
      }

      console.log('Attempting to generate a new token automatically...');
      await this.generateAccessToken(null, { skipBootstrap: true });

      this.kc = new KiteConnect({
        api_key: this.apiKey,
        access_token: this.accessToken
      });

      profile = await this.kc.getProfile();
      console.log('✅ KiteConnect initialized with new token');
      console.log('User:', profile.user_name, '(' + profile.user_id + ')');
    }

    this.lastProfile = profile;

    // Initialize WebSocket ticker for live data
    this.initializeTicker({ forceConnect: forceTickerConnect });

    this.isBootstrapped = true;

    return profile;
  }

  /**
   * Update Zerodha API credentials
   */
  async updateCredentials({ apiKey, apiSecret }) {
    if (!apiKey || !apiSecret) {
      throw new Error('API key and API secret are required');
    }

    console.log('🔐 Updating Zerodha API credentials');

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    process.env.API_KEY = apiKey;
    process.env.API_SECRET = apiSecret;

    // Reset current session/token state
    this.accessToken = null;
    this.isBootstrapped = false;
    this.kc = null;

    if (this.ticker && this.ticker.connected && this.ticker.connected()) {
      this.ticker.disconnect();
    }
    this.ticker = null;

    this.subscribedTokens.clear();
    this.livePriceCache.clear();
    this.priceCallbacks.clear();
    this.lastTokenData = null;

    // Remove any existing token cache on credential change
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
      }
    } catch (err) {
      console.warn('⚠️ Unable to remove existing token file:', err.message);
    }

    this.saveCredentials();

    return {
      message: 'Zerodha API credentials updated successfully'
    };
  }

  /**
   * Initialize WebSocket ticker
   */
  initializeTicker({ forceConnect = false } = {}) {
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
        if (this.subscribedTokens.size > 0) {
          const tokensToResubscribe = Array.from(this.subscribedTokens)
            .map(token => parseInt(token))
            .filter(token => !isNaN(token) && token > 0);

          if (tokensToResubscribe.length > 0) {
            try {
              this.ticker.subscribe(tokensToResubscribe);
              this.ticker.setMode(this.ticker.modeLTP, tokensToResubscribe);
              console.log('🔁 Resubscribed to tokens after reconnect:', tokensToResubscribe);
            } catch (resubscribeError) {
              console.error('Failed to resubscribe after reconnect:', resubscribeError);
            }
          }
        }
      });

      this.ticker.on('disconnect', () => {
        console.log('📡 WebSocket ticker disconnected');
      });

      this.ticker.on('error', (error) => {
        console.error('WebSocket ticker error:', error);
      });

      // Connect during market hours
      if (forceConnect || this.isMarketHours) {
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
   * Manually set the access token (admin helper)
   */
  async setManualAccessToken({
    accessToken,
    userId = null,
    userName = null,
    userShortName = null,
    email = null,
    publicToken = null,
    loginTime = null,
    generatedAt = null,
    skipValidation = false,
    forceTickerConnect = false
  } = {}) {
    if (!accessToken) {
      throw new Error('accessToken is required');
    }

    const sanitizedToken = String(accessToken).trim();

    if (!sanitizedToken) {
      throw new Error('accessToken cannot be empty');
    }

    if (!this.apiKey) {
      throw new Error('Set Zerodha API credentials before updating the access token.');
    }

    const tokenPayload = {
      access_token: sanitizedToken,
      user_id: userId,
      user_name: userName,
      user_shortname: userShortName,
      email,
      public_token: publicToken,
      login_time: loginTime,
      generated_at: generatedAt,
      api_key: this.apiKey,
      source: 'manual'
    };

    if (skipValidation) {
      if (this.ticker && this.ticker.connected && this.ticker.connected()) {
        this.ticker.disconnect();
      }
      this.accessToken = sanitizedToken;
      this.kc = new KiteConnect({
        api_key: this.apiKey,
        access_token: this.accessToken
      });
      this.lastProfile = null;
      this.livePriceCache.clear();
      this.initializeTicker({ forceConnect: forceTickerConnect });
      this.isBootstrapped = true;

      const persisted = this.persistToken(tokenPayload, 'manual');

      return {
        ...persisted,
        validated: false
      };
    }

    const validationClient = new KiteConnect({
      api_key: this.apiKey,
      access_token: sanitizedToken
    });

    let profile;

    try {
      profile = await validationClient.getProfile();
    } catch (error) {
      throw new Error(`Access token validation failed: ${error.message}`);
    }

    if (this.ticker && this.ticker.connected && this.ticker.connected()) {
      this.ticker.disconnect();
    }

    this.accessToken = sanitizedToken;
    this.kc = validationClient;
    this.lastProfile = profile;
    this.livePriceCache.clear();
    this.initializeTicker({ forceConnect: forceTickerConnect });
    this.isBootstrapped = true;

    const persisted = this.persistToken({
      ...tokenPayload,
      user_id: profile.user_id || tokenPayload.user_id,
      user_name: profile.user_name || tokenPayload.user_name,
      user_shortname: profile.user_shortname || tokenPayload.user_shortname,
      email: profile.email || tokenPayload.email
    }, 'manual');

    return {
      ...persisted,
      validated: true,
      profile: {
        user_id: profile.user_id,
        user_name: profile.user_name,
        user_shortname: profile.user_shortname || null,
        email: profile.email || null
      }
    };
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
    this.lastProfile = null;

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

  /**
   * Refresh token helper exposed for admin routes
   */
  async refreshAccessToken({ reason = 'manual' } = {}) {
    console.log(`🔁 Refresh access token requested (reason: ${reason})`);
    await this.refreshToken();

    return {
      access_token: this.accessToken,
      reason,
      generated_at: this.lastTokenData ? (this.lastTokenData.generated_at || this.lastTokenData.login_time) : null
    };
  }

  /**
   * Credential and token status summary
   */
  async getCredentialStatus() {
    const status = {
      apiKeyConfigured: Boolean(this.apiKey),
      tokenFileExists: fs.existsSync(this.tokenFilePath),
      credentialsFileExists: fs.existsSync(this.credentialsFilePath),
      accessTokenAvailable: Boolean(this.accessToken),
      lastTokenGeneratedAt: this.lastTokenData ? (this.lastTokenData.generated_at || this.lastTokenData.login_time) : null,
      lastTokenSource: this.lastTokenData ? this.lastTokenData.source || null : null,
      lastProfile: this.lastProfile ? {
        user_id: this.lastProfile.user_id,
        user_name: this.lastProfile.user_name,
        user_shortname: this.lastProfile.user_shortname || null,
        email: this.lastProfile.email || null
      } : null
    };

    if (status.lastTokenGeneratedAt) {
      const generatedAtDate = new Date(status.lastTokenGeneratedAt);
      if (!isNaN(generatedAtDate.getTime())) {
        status.tokenAgeHours = Math.round((Date.now() - generatedAtDate.getTime()) / (60 * 60 * 1000));
      }
    }

    return status;
  }
}

module.exports = ZerodhaService;
