import { KiteConnect } from "kiteconnect";
import fs from "fs";

// Create a test token for development
const testToken = {
  access_token: "test_access_token_" + Date.now(),
  refresh_token: null,
  user_id: "cvp941",
  user_name: "Test User",
  user_shortname: "Test",
  avatar_url: null,
  user_type: "individual",
  email: "test@example.com",
  login_time: new Date().toISOString(),
  public_token: null,
  api_key: process.env.API_KEY,
  generated_at: new Date().toISOString()
};

fs.writeFileSync("./kite_token.json", JSON.stringify(testToken, null, 2));
console.log("✅ Test token generated and saved to kite_token.json");
console.log("This is for development testing only.");
