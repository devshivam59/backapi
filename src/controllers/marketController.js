const fs = require('fs');
const { parse } = require('csv-parse');
const Instrument = require('../models/Instrument');

const safeRemove = (path) => {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
};

exports.searchInstruments = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = search
      ? {
          $or: [
            { symbol: new RegExp(search, 'i') },
            { name: new RegExp(search, 'i') },
            { isin: new RegExp(search, 'i') },
          ],
        }
      : {};
    const instruments = await Instrument.find(query).limit(50);
    res.json(instruments);
  } catch (error) {
    next(error);
  }
};

exports.getLivePrice = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const instrument = await Instrument.findOne({ symbol: symbol.toUpperCase() });
    if (!instrument) {
      return res.status(404).json({ message: 'Instrument not found' });
    }
    const change = (Math.random() - 0.5) * 2;
    instrument.lastPrice = Math.max(0, instrument.lastPrice + change);
    instrument.dailyChange = change;
    await instrument.save();
    res.json({ symbol: instrument.symbol, lastPrice: instrument.lastPrice, change });
  } catch (error) {
    next(error);
  }
};

exports.importInstruments = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'CSV file is required' });
  }

  const filePath = req.file.path;
  const instruments = [];

  const parser = fs
    .createReadStream(filePath)
    .pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
    );

  parser.on('data', (row) => {
    instruments.push({
      symbol: (row.symbol || row.tradingsymbol || '').toUpperCase(),
      name: row.name || row.description || row.symbol,
      exchange: row.exchange || row.exch,
      segment: row.segment,
      instrumentType: row.instrument_type || row.instrumentType,
      lotSize: Number(row.lot_size || row.lotsize || 1),
      tickSize: Number(row.tick_size || row.ticksize || 0.05),
      isin: row.isin,
      lastPrice: Number(row.last_price || row.ltp || 0),
    });
  });

  parser.on('error', (err) => {
    safeRemove(filePath);
    next(err);
  });

  parser.on('end', async () => {
    safeRemove(filePath);
    try {
      const bulkOps = instruments
        .filter((inst) => inst.symbol)
        .map((inst) => ({
          updateOne: {
            filter: { symbol: inst.symbol },
            update: { $set: inst },
            upsert: true,
          },
        }));
      if (bulkOps.length) {
        await Instrument.bulkWrite(bulkOps);
      }
      res.json({ message: `Imported ${bulkOps.length} instruments` });
    } catch (error) {
      next(error);
    }
  });
};
