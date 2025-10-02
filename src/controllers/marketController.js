const fs = require('fs');
const csv = require('csv-parser');
const Instrument = require("../models/Instrument");

/**
 * Get instruments with pagination and search
 */
exports.getInstruments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, exchange, instrument_type } = req.query;
    const query = {};

    // Add search functionality
    if (search) {
      query.$or = [
        { tradingsymbol: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    // Add filters
    if (exchange) query.exchange = exchange;
    if (instrument_type) query.instrument_type = instrument_type;

    const skip = (page - 1) * limit;
    const instruments = await Instrument.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ tradingsymbol: 1 });

    const total = await Instrument.countDocuments(query);

    res.json({
      success: true,
      data: instruments,
      total: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching instruments:", error);
    next(error);
  }
};

/**
 * Search instruments
 */
exports.searchInstruments = async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.json({
        success: true,
        data: [],
        total: 0
      });
    }

    const query = {
      $or: [
        { tradingsymbol: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ]
    };

    const instruments = await Instrument.find(query)
      .limit(parseInt(limit))
      .sort({ tradingsymbol: 1 });

    const total = await Instrument.countDocuments(query);

    res.json({
      success: true,
      data: instruments,
      total: total
    });
  } catch (error) {
    console.error("Error searching instruments:", error);
    next(error);
  }
};

/**
 * Get instrument statistics
 */
exports.getInstrumentStats = async (req, res, next) => {
  try {
    const totalCount = await Instrument.countDocuments();
    
    const exchangeStats = await Instrument.aggregate([
      { $group: { _id: "$exchange", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const typeStats = await Instrument.aggregate([
      { $group: { _id: "$instrument_type", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const segmentStats = await Instrument.aggregate([
      { $group: { _id: "$segment", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const exchanges = {};
    exchangeStats.forEach(stat => {
      exchanges[stat._id || "Unknown"] = stat.count;
    });

    const instrumentTypes = {};
    typeStats.forEach(stat => {
      instrumentTypes[stat._id || "Unknown"] = stat.count;
    });

    const segments = {};
    segmentStats.forEach(stat => {
      segments[stat._id || "Unknown"] = stat.count;
    });

    res.json({
      success: true,
      data: {
        total: totalCount,
        exchanges,
        instrumentTypes,
        segments
      }
    });
  } catch (error) {
    console.error("Error fetching instrument stats:", error);
    next(error);
  }
};

/**
 * Import instruments from CSV
 */
exports.importInstruments = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    console.log(`Processing CSV file: ${req.file.filename}`);
    const instruments = [];
    let processedCount = 0;
    let errorCount = 0;

    // Read and parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Map CSV columns to instrument fields
            const instrument = {
              instrument_token: row.instrument_token || Math.floor(Math.random() * 1000000),
              exchange_token: row.exchange_token || Math.floor(Math.random() * 100000),
              tradingsymbol: row.tradingsymbol || row.symbol || row.trading_symbol,
              name: row.name || row.company_name || row.tradingsymbol,
              last_price: parseFloat(row.last_price) || 0,
              expiry: row.expiry || null,
              strike: parseFloat(row.strike) || 0,
              tick_size: parseFloat(row.tick_size) || 0.05,
              lot_size: parseInt(row.lot_size) || 1,
              instrument_type: row.instrument_type || row.type || 'EQ',
              segment: row.segment || row.exchange,
              exchange: row.exchange || 'NSE',
              isin: row.isin || null
            };

            // Validate required fields
            if (instrument.tradingsymbol && instrument.name) {
              instruments.push(instrument);
              processedCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            console.error('Error processing row:', error);
            errorCount++;
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Parsed ${processedCount} instruments from CSV`);

    // Bulk insert instruments
    let insertedCount = 0;
    let updatedCount = 0;

    if (instruments.length > 0) {
      // Use upsert to handle duplicates
      const bulkOps = instruments.map(instrument => ({
        updateOne: {
          filter: { tradingsymbol: instrument.tradingsymbol, exchange: instrument.exchange },
          update: { $set: instrument },
          upsert: true
        }
      }));

      const result = await Instrument.bulkWrite(bulkOps);
      insertedCount = result.upsertedCount;
      updatedCount = result.modifiedCount;
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Successfully processed ${processedCount} instruments`,
      data: {
        processed: processedCount,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount,
        filename: req.file.filename
      }
    });

  } catch (error) {
    console.error("Error importing instruments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import instruments",
      error: error.message
    });
  }
};

/**
 * Clear all instruments from database
 */
exports.clearAllInstruments = async (req, res, next) => {
  try {
    console.log('Clearing all instruments from database...');
    const result = await Instrument.deleteMany({});
    console.log(`Deleted ${result.deletedCount} instruments`);
    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} instruments from database`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    console.error('Error clearing instruments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear instruments',
      error: error.message
    });
  }
};

/**
 * Import instruments with replace option
 */
exports.importInstrumentsWithReplace = async (req, res, next) => {
  try {
    const { replaceExisting = false } = req.body;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded'
      });
    }
    console.log(`Starting instrument import with replace: ${replaceExisting}`);
    if (replaceExisting) {
      console.log('Clearing existing instruments...');
      const deleteResult = await Instrument.deleteMany({});
      console.log(`Cleared ${deleteResult.deletedCount} existing instruments`);
    }
    // Use the existing importInstruments logic
    return exports.importInstruments(req, res, next);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import instruments',
      error: error.message
    });
  }
};

/**
 * Get single instrument by ID
 */
exports.getInstrument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const instrument = await Instrument.findById(id);
    
    if (!instrument) {
      return res.status(404).json({
        success: false,
        message: "Instrument not found"
      });
    }

    res.json({
      success: true,
      data: instrument
    });
  } catch (error) {
    console.error("Error fetching instrument:", error);
    next(error);
  }
};
