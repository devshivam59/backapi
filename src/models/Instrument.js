const mongoose = require('mongoose');

// Create a very flexible schema that accepts any fields
const instrumentSchema = new mongoose.Schema(
  {},  // Empty schema definition - allows any fields
  { 
    timestamps: true,
    strict: false,  // Allow any additional fields
    collection: 'instruments'  // Explicit collection name
  }
);

// Add some basic indexes for performance
instrumentSchema.index({ instrument_token: 1 }, { unique: true, sparse: true });
instrumentSchema.index({ tradingsymbol: 1, exchange: 1 }, { sparse: true });
instrumentSchema.index({ symbol: 1 }, { sparse: true });
instrumentSchema.index({ name: 'text', tradingsymbol: 'text', symbol: 'text' });

module.exports = mongoose.model('Instrument', instrumentSchema);
