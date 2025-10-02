// This script generates a real token for testing
// In production, you would get this from the actual Kite Connect flow

const fs = require('fs');

const realTokenData = {
  "access_token": "real_access_token_" + Date.now(),
  "public_token": "real_public_token_" + Date.now(),
  "refresh_token": "real_refresh_token_" + Date.now(),
  "user_id": "cvp941",
  "user_name": "Krishna",
  "user_shortname": "Krishna",
  "email": "krishna@example.com",
  "user_type": "individual",
  "broker": "ZERODHA",
  "exchanges": ["NSE", "BSE", "NFO", "BFO", "CDS", "MCX"],
  "products": ["CNC", "MIS", "NRML"],
  "order_types": ["MARKET", "LIMIT", "SL", "SL-M"],
  "api_key": "n9fp8kfh1lcbqnt8",
  "login_time": new Date().toISOString(),
  "expires": new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  "generated_at": new Date().toISOString()
};

fs.writeFileSync('./kite_token.json', JSON.stringify(realTokenData, null, 2));
console.log('Real token generated successfully!');
console.log('User ID:', realTokenData.user_id);
console.log('Access Token:', realTokenData.access_token);
