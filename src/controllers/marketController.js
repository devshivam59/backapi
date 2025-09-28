const fs = require("fs");
const { parse } = require("csv-parse");
const Instrument = require("../models/Instrument");

const safeRemove = (path) => {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
};

// Advanced fuzzy search function
const buildAdvancedSearchQuery = (searchTerm) => {
  if (!searchTerm) return {};
  
  // Split search term into individual keywords
  const keywords = searchTerm.trim().split(/\s+/).filter(k => k.length > 0);
  
  if (keywords.length === 0) return {};
  
  // For single keyword, use simple regex
  if (keywords.length === 1) {
    const keyword = keywords[0];
    return {
      $or: [
        { symbol: new RegExp(keyword, "i") },
        { name: new RegExp(keyword, "i") },
        { isin: new RegExp(keyword, "i") },
        { tradingsymbol: new RegExp(keyword, "i") },
        { instrument_token: new RegExp(keyword, "i") },
        { exchange_token: new RegExp(keyword, "i") }
      ]
    };
  }
  
  // For multiple keywords, each keyword must match at least one field
  const keywordQueries = keywords.map(keyword => ({
    $or: [
      { symbol: new RegExp(keyword, "i") },
      { name: new RegExp(keyword, "i") },
      { isin: new RegExp(keyword, "i") },
      { tradingsymbol: new RegExp(keyword, "i") },
      { instrument_token: new RegExp(keyword, "i") },
      { exchange_token: new RegExp(keyword, "i") }
    ]
  }));
  
  // All keywords must match (AND logic)
  return { $and: keywordQueries };
};

exports.searchInstruments = async (req, res, next) => {
  try {
    const { search, limit = 100, page = 1, exchange, instrumentType } = req.query;
    
    // Build query
    const query = {};
    
    // Advanced search filter
    if (search) {
      const searchQuery = buildAdvancedSearchQuery(search);
      Object.assign(query, searchQuery);
    }
    
    // Exchange filter
    if (exchange) {
      query.exchange = exchange;
    }
    
    // Instrument type filter
    if (instrumentType) {
      query.instrumentType = instrumentType;
    }
    
    // Pagination
    const limitNum = Math.min(parseInt(limit), 1000); // Max 1000 per request
    const skip = (parseInt(page) - 1) * limitNum;
    
    // Get total count for pagination
    const total = await Instrument.countDocuments(query);
    
    // Get instruments with scoring for relevance
    let instruments;
    
    if (search) {
      // Use aggregation for better scoring when searching
      const keywords = search.trim().split(/\s+/).filter(k => k.length > 0);
      
      instruments = await Instrument.aggregate([
        { $match: query },
        {
          $addFields: {
            // Calculate relevance score
            relevanceScore: {
              $add: [
                // Exact symbol match gets highest score
                { $cond: [{ $regexMatch: { input: "$symbol", regex: new RegExp("^" + search + "$", "i") } }, 100, 0] },
                // Symbol starts with search term
                { $cond: [{ $regexMatch: { input: "$symbol", regex: new RegExp("^" + search, "i") } }, 50, 0] },
                // Trading symbol starts with search term
                { $cond: [{ $regexMatch: { input: "$tradingsymbol", regex: new RegExp("^" + search, "i") } }, 45, 0] },
                // Symbol contains search term
                { $cond: [{ $regexMatch: { input: "$symbol", regex: new RegExp(search, "i") } }, 25, 0] },
                // Trading symbol contains search term
                { $cond: [{ $regexMatch: { input: "$tradingsymbol", regex: new RegExp(search, "i") } }, 20, 0] },
                // Name contains search term
                { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(search, "i") } }, 15, 0] },
                // Add points for each keyword match
                ...keywords.map(keyword => ({
                  $cond: [
                    {
                      $or: [
                        { $regexMatch: { input: "$symbol", regex: new RegExp(keyword, "i") } },
                        { $regexMatch: { input: "$tradingsymbol", regex: new RegExp(keyword, "i") } },
                        { $regexMatch: { input: "$name", regex: new RegExp(keyword, "i") } }
                      ]
                    },
                    10,
                    0
                  ]
                }))
              ]
            }
          }
        },
        { $sort: { relevanceScore: -1, symbol: 1 } },
        { $skip: skip },
        { $limit: limitNum }
      ]);
    } else {
      // Simple query without scoring
      instruments = await Instrument.find(query)
        .limit(limitNum)
        .skip(skip)
        .sort({ symbol: 1 });
    }
    
    res.json({
      instruments,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLivePrice = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const instrument = await Instrument.findOne({ symbol: symbol.toUpperCase() });
    if (!instrument) {
      return res.status(404).json({ message: "Instrument not found" });
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

exports.getInstrumentStats = async (req, res, next) => {
  try {
    const totalInstruments = await Instrument.countDocuments();
    
    const exchangeStats = await Instrument.aggregate([
      { $group: { _id: "$exchange", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const typeStats = await Instrument.aggregate([
      { $group: { _id: "$instrumentType", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      total: totalInstruments,
      exchanges: exchangeStats,
      types: typeStats
    });
  } catch (error) {
    next(error);
  }
};

exports.importInstruments = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file is required" });
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
  parser.on("data", (row) => {
    instruments.push({
      symbol: (row.symbol || row.tradingsymbol || "").toUpperCase(),
      tradingsymbol: row.tradingsymbol || row.symbol || "",
      name: row.name || row.description || row.symbol,
      exchange: row.exchange || row.exch,
      segment: row.segment,
      instrumentType: row.instrument_type || row.instrumentType,
      lotSize: Number(row.lot_size || row.lotsize || 1),
      tickSize: Number(row.tick_size || row.ticksize || 0.05),
      isin: row.isin,
      lastPrice: Number(row.last_price || row.ltp || 0),
      instrument_token: row.instrument_token,
      exchange_token: row.exchange_token,
      expiry: row.expiry,
      strike: Number(row.strike || 0)
    });
  });
  parser.on("error", (err) => {
    safeRemove(filePath);
    next(err);
  });
  parser.on("end", async () => {
    safeRemove(filePath);
    try {
      const bulkOps = instruments
        .filter((inst) => inst.symbol || inst.tradingsymbol)
        .map((inst) => ({
          updateOne: {
            filter: { 
              $or: [
                { symbol: inst.symbol },
                { tradingsymbol: inst.tradingsymbol }
              ]
            },
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
