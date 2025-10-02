const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/controllers/marketController.js', 'utf8');

// Find the getInstruments function and replace its response
const getInstrumentsStart = content.indexOf('exports.getInstruments = async');
const getInstrumentsEnd = content.indexOf('exports.searchInstruments', getInstrumentsStart);

if (getInstrumentsStart !== -1 && getInstrumentsEnd !== -1) {
  const beforeFunction = content.substring(0, getInstrumentsStart);
  const afterFunction = content.substring(getInstrumentsEnd);
  
  const newFunction = `exports.getInstruments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = "",
      exchange = "",
      instrument_type = "",
      sort = "tradingsymbol",
      order = "asc"
    } = req.query;

    // Build search query
    const query = {};
    
    // Search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { tradingsymbol: searchRegex },
        { name: searchRegex },
        { symbol: searchRegex }
      ];
    }

    // Filter by exchange
    if (exchange && exchange.trim()) {
      query.exchange = exchange.trim().toUpperCase();
    }

    // Filter by instrument type
    if (instrument_type && instrument_type.trim()) {
      query.instrument_type = instrument_type.trim().toUpperCase();
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOrder = order === "desc" ? -1 : 1;
    const sortObj = {};
    sortObj[sort] = sortOrder;

    // Execute query with pagination
    const [instruments, total] = await Promise.all([
      Instrument.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Instrument.countDocuments(query)
    ]);

    // Add live prices from mock service if available
    const instrumentsWithPrices = instruments.map(instrument => ({
      ...instrument,
      // Add current price simulation
      current_price: instrument.last_price + (Math.random() - 0.5) * 10,
      change: (Math.random() - 0.5) * 20,
      change_percent: (Math.random() - 0.5) * 5
    }));

    res.json({
      success: true,
      data: instrumentsWithPrices,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      filters: {
        search,
        exchange,
        instrument_type,
        sort,
        order
      }
    });

  } catch (error) {
    console.error("Error fetching instruments:", error);
    next(error);
  }
};

`;

  const newContent = beforeFunction + newFunction + afterFunction;
  fs.writeFileSync('src/controllers/marketController.js', newContent);
  console.log('Successfully updated getInstruments function');
} else {
  console.log('Could not find getInstruments function');
}
