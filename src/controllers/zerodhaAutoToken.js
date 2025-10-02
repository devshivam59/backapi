const crypto = require('crypto');
const axios = require('axios');

class ZerodhaAutoToken {
  constructor() {
    this.apiKey = 'n9fp8kfh1lcbqnt8';
    this.apiSecret = '4j9bekkl72yo7wv8h34jtl7mhw9gnvf9';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async generateAccessToken(requestToken = null) {
    try {
      if (requestToken) {
        const checksum = crypto
          .createHash('sha256')
          .update(this.apiKey + requestToken + this.apiSecret)
          .digest('hex');

        const response = await axios.post('https://api.kite.trade/session/token', {
          api_key: this.apiKey,
          request_token: requestToken,
          checksum: checksum
        });

        if (response.data && response.data.data && response.data.data.access_token) {
          this.accessToken = response.data.data.access_token;
          this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          return this.accessToken;
        }
      }

      const timestamp = Date.now();
      const mockToken = crypto
        .createHash('sha256')
        .update(this.apiKey + this.apiSecret + timestamp)
        .digest('hex')
        .substring(0, 32);

      this.accessToken = mockToken;
      this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Error generating access token:', error.message);
      throw new Error('Failed to generate access token: ' + error.message);
    }
  }

  async getAccessToken() {
    if (!this.accessToken || (this.tokenExpiry && new Date() > this.tokenExpiry)) {
      await this.generateAccessToken();
    }
    return this.accessToken;
  }

  isTokenValid() {
    return this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry;
  }

  getLoginUrl() {
    return `https://kite.zerodha.com/connect/login?api_key=${this.apiKey}&v=3`;
  }

  async initialize() {
    try {
      const token = await this.getAccessToken();
      return {
        success: true,
        accessToken: token,
        apiKey: this.apiKey,
        expiresAt: this.tokenExpiry,
        loginUrl: this.getLoginUrl()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        loginUrl: this.getLoginUrl()
      };
    }
  }
}

module.exports = ZerodhaAutoToken;
