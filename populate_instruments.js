const mongoose = require('mongoose');
const Instrument = require('./src/models/Instrument');

// Sample instruments data
const sampleInstruments = [
  {
    instrument_token: 256265,
    exchange_token: 1001,
    tradingsymbol: 'RELIANCE',
    name: 'RELIANCE INDUSTRIES LTD',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 2456.75,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE002A01018'
  },
  {
    instrument_token: 738561,
    exchange_token: 2885,
    tradingsymbol: 'INFY',
    name: 'INFOSYS LTD',
    symbol: 'INFY',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 1789.30,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE009A01021'
  },
  {
    instrument_token: 779521,
    exchange_token: 3045,
    tradingsymbol: 'TCS',
    name: 'TATA CONSULTANCY SERVICES LTD',
    symbol: 'TCS',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 3987.65,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE467B01029'
  },
  {
    instrument_token: 60417,
    exchange_token: 236,
    tradingsymbol: 'HDFCBANK',
    name: 'HDFC BANK LTD',
    symbol: 'HDFCBANK',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 1654.20,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE040A01034'
  },
  {
    instrument_token: 81153,
    exchange_token: 317,
    tradingsymbol: 'ICICIBANK',
    name: 'ICICI BANK LTD',
    symbol: 'ICICIBANK',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 1234.50,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE090A01021'
  },
  {
    instrument_token: 2953217,
    exchange_token: 11536,
    tradingsymbol: 'WIPRO',
    name: 'WIPRO LTD',
    symbol: 'WIPRO',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 567.80,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE075A01022'
  },
  {
    instrument_token: 225537,
    exchange_token: 881,
    tradingsymbol: 'LT',
    name: 'LARSEN & TOUBRO LTD',
    symbol: 'LT',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 3456.90,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE018A01030'
  },
  {
    instrument_token: 884737,
    exchange_token: 3456,
    tradingsymbol: 'ADANIPORTS',
    name: 'ADANI PORTS & SEZ LTD',
    symbol: 'ADANIPORTS',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 1234.75,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE742F01042'
  },
  {
    instrument_token: 1270529,
    exchange_token: 4963,
    tradingsymbol: 'BHARTIARTL',
    name: 'BHARTI AIRTEL LTD',
    symbol: 'BHARTIARTL',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 987.65,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE397D01024'
  },
  {
    instrument_token: 348929,
    exchange_token: 1363,
    tradingsymbol: 'MARUTI',
    name: 'MARUTI SUZUKI INDIA LTD',
    symbol: 'MARUTI',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 11234.50,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE585B01010'
  },
  {
    instrument_token: 41729,
    exchange_token: 163,
    tradingsymbol: 'ASIANPAINT',
    name: 'ASIAN PAINTS LTD',
    symbol: 'ASIANPAINT',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 3234.80,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE021A01026'
  },
  {
    instrument_token: 2815745,
    exchange_token: 10999,
    tradingsymbol: 'ULTRACEMCO',
    name: 'ULTRATECH CEMENT LTD',
    symbol: 'ULTRACEMCO',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 8765.40,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE481G01011'
  },
  {
    instrument_token: 2714625,
    exchange_token: 10604,
    tradingsymbol: 'TITAN',
    name: 'TITAN COMPANY LTD',
    symbol: 'TITAN',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 3456.20,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE280A01028'
  },
  {
    instrument_token: 1346049,
    exchange_token: 5258,
    tradingsymbol: 'COALINDIA',
    name: 'COAL INDIA LTD',
    symbol: 'COALINDIA',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 456.75,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE522F01014'
  },
  {
    instrument_token: 2977281,
    exchange_token: 11630,
    tradingsymbol: 'NESTLEIND',
    name: 'NESTLE INDIA LTD',
    symbol: 'NESTLEIND',
    exchange: 'NSE',
    segment: 'NSE',
    instrument_type: 'EQ',
    last_price: 23456.80,
    tick_size: 0.05,
    lot_size: 1,
    isin: 'INE239A01016'
  }
];

const populateInstruments = async () => {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/trading_app');
    console.log('✅ Connected to MongoDB');
    
    // Clear existing instruments
    console.log('🗑️ Clearing existing instruments...');
    await Instrument.deleteMany({});
    
    // Insert sample instruments
    console.log('📊 Inserting sample instruments...');
    const result = await Instrument.insertMany(sampleInstruments);
    
    console.log(`✅ Successfully inserted ${result.length} instruments`);
    
    // Verify insertion
    const count = await Instrument.countDocuments();
    console.log(`📈 Total instruments in database: ${count}`);
    
    // Show sample search results
    console.log('🔍 Testing search functionality...');
    const searchResults = await Instrument.find({
      $or: [
        { tradingsymbol: { $regex: 'REL', $options: 'i' } },
        { name: { $regex: 'REL', $options: 'i' } }
      ]
    }).limit(3);
    
    console.log('Search results for "REL":');
    searchResults.forEach(inst => {
      console.log(`- ${inst.tradingsymbol}: ${inst.name}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

populateInstruments();
