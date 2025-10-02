const fs = require('fs');
const csv = require('csv-parser');
const Instrument = require('../models/Instrument');

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
