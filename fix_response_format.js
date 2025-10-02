const fs = require('fs');

// Read the current controller
let content = fs.readFileSync('src/controllers/marketController.js', 'utf8');

// Find and replace the response format in getInstruments
const oldResponse = `res.json({
      success: true,
      data: {
        instruments: instrumentsWithPrices,
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
      }
    });`;

const newResponse = `res.json({
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
    });`;

// Replace the response format
content = content.replace(
  /res\.json\(\{\s*success: true,\s*data: \{\s*instruments: instrumentsWithPrices,[\s\S]*?\}\s*\}\);/,
  newResponse
);

// Write back the file
fs.writeFileSync('src/controllers/marketController.js', content);
console.log('Fixed response format in marketController.js');
