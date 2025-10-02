const dotenv = require("dotenv");
const puppeteer = require("puppeteer");
const { authenticator } = require("otplib");
const fs = require("fs");
const { KiteConnect } = require("kiteconnect");

dotenv.config();

const {
  API_KEY, API_SECRET, KITE_USER, KITE_PASS, KITE_TOTP_SECRET, REDIRECT_URI
} = process.env;

const kite = new KiteConnect({ api_key: API_KEY });
const loginUrl = kite.getLoginURL({ redirect_uri: REDIRECT_URI });

console.log("Starting Kite Connect auto-login process...");
console.log("Login URL:", loginUrl);

const getRequestToken = async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ] 
  });
  
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to login page...");
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Wait for page to load completely
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot for debugging
    await page.screenshot({ path: "login_page_initial.png" });
    console.log("Initial page screenshot saved");
    
    // Save page HTML for debugging
    const initialHtml = await page.content();
    fs.writeFileSync("login_page_initial.html", initialHtml);
    
    console.log("Filling username and password...");
    
    // Wait for userid field and fill it
    await page.waitForSelector("#userid", { timeout: 10000 });
    await page.type("#userid", KITE_USER);
    
    // Wait for password field and fill it
    await page.waitForSelector("#password", { timeout: 10000 });
    await page.type("#password", KITE_PASS);
    
    // Take screenshot after filling credentials
    await page.screenshot({ path: "login_page_after_credentials.png" });
    console.log("Credentials filled, screenshot saved");
    
    // Click submit button
    await page.click('button[type="submit"]');
    console.log("Clicked submit button");
    
    // Wait for page to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if TOTP is required
    const totpField = await page.$("#totp");
    if (totpField && KITE_TOTP_SECRET) {
      console.log("TOTP field detected, generating and entering TOTP...");
      const code = authenticator.generate(KITE_TOTP_SECRET);
      console.log("Generated TOTP code:", code);
      
      await page.type("#totp", String(code));
      await page.screenshot({ path: "login_page_after_totp.png" });
      
      // Click submit for TOTP
      await page.click('button[type="submit"]');
      console.log("TOTP submitted");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Wait for redirect to callback URL
    console.log("Waiting for redirect to callback URL...");
    await page.waitForNavigation({ 
      waitUntil: "load", 
      timeout: 20000 
    });
    
    const finalUrl = page.url();
    console.log("Final URL:", finalUrl);
    
    // Take final screenshot
    await page.screenshot({ path: "login_page_final.png" });
    
    const urlObj = new URL(finalUrl);
    const rt = urlObj.searchParams.get("request_token");
    
    if (!rt) {
      // Save page content for debugging
      const finalHtml = await page.content();
      fs.writeFileSync("login_page_final.html", finalHtml);
      throw new Error("Request token not found in URL. Check login_page_final.html for debugging.");
    }
    
    console.log("Request token captured:", rt);
    
    await browser.close();
    return rt;
    
  } catch (error) {
    console.error("Error during login process:", error);
    
    // Save page content for debugging
    try {
      const errorHtml = await page.content();
      fs.writeFileSync("login_page_error.html", errorHtml);
      await page.screenshot({ path: "login_page_error.png" });
      console.log("Error page content saved for debugging");
    } catch (debugError) {
      console.error("Could not save debug info:", debugError);
    }
    
    await browser.close();
    throw error;
  }
};

const exchangeAndSave = async (requestToken) => {
  console.log("Exchanging request token for access token...");
  
  try {
    const session = await kite.generateSession(requestToken, API_SECRET);
    console.log("Session generated successfully");
    
    // Set access token
    kite.setAccessToken(session.access_token);
    
    // Save session data to file
    const sessionData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token || null,
      user_id: session.user_id,
      user_name: session.user_name || null,
      user_shortname: session.user_shortname || null,
      avatar_url: session.avatar_url || null,
      user_type: session.user_type || null,
      email: session.email || null,
      login_time: session.login_time,
      public_token: session.public_token || null,
      api_key: session.api_key,
      generated_at: new Date().toISOString()
    };
    
    fs.writeFileSync("./kite_token.json", JSON.stringify(sessionData, null, 2));
    console.log("✅ Access token saved to kite_token.json");
    console.log("User ID:", session.user_id);
    console.log("Login time:", session.login_time);
    
    return sessionData;
    
  } catch (error) {
    console.error("Error generating session:", error);
    throw error;
  }
};

const authenticateKite = async () => {
  try {
    console.log("🚀 Starting Kite Connect authentication...");
    
    const rt = await getRequestToken();
    if (!rt) {
      throw new Error("Failed to capture request_token.");
    }
    
    const sessionData = await exchangeAndSave(rt);
    
    console.log("🎉 Authentication completed successfully!");
    console.log("Access token is valid and saved.");
    
    return sessionData;
    
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    throw error;
  }
};

module.exports = { authenticateKite, getRequestToken, exchangeAndSave };
