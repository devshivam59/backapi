const mongoose = require('mongoose');

const ZerodhaCredentialSchema = new mongoose.Schema({
  apiKey: {
    type: String,
    required: true,
    trim: true
  },
  apiSecret: {
    type: String,
    required: true,
    trim: true
  },
  requestToken: {
    type: String,
    default: null
  },
  accessToken: {
    type: String,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  lastAccessTokenGeneratedAt: {
    type: Date,
    default: null
  },
  lastRequestTokenAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ZerodhaCredential', ZerodhaCredentialSchema);
