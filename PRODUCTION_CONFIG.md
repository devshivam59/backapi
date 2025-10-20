# Production Configuration Guide

## 🚀 Switching from Testing Mode to Production Mode

The application is currently in **Testing Mode** where the market is considered "open" 24/7 (except weekends) to allow WebSocket testing at any time.

For **Production Mode**, you need to restore the normal market hours (9:15 AM - 3:30 PM IST).

---

## 📝 Configuration Steps

### 1. Restore Normal Market Hours

**File**: `frontend/watchlist.html`

**Line Numbers**: 406-413

**Current (Testing Mode)**:
```javascript
// NSE/BSE: 9:15 AM - 3:30 PM IST
// TESTING MODE: Extended hours for WebSocket testing
const marketOpen = 0;  // 12:00 AM (testing)
const marketClose = 23 * 60 + 59; // 11:59 PM (testing)

const isOpen = timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
console.log(`[Market] IST Time: ${istTime.toLocaleTimeString()}, Status: ${isOpen ? 'OPEN (Testing Mode)' : 'CLOSED'}`);
return isOpen;
```

**Change to (Production Mode)**:
```javascript
// NSE/BSE: 9:15 AM - 3:30 PM IST
const marketOpen = 9 * 60 + 15;  // 9:15 AM
const marketClose = 15 * 60 + 30; // 3:30 PM

const isOpen = timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
console.log(`[Market] IST Time: ${istTime.toLocaleTimeString()}, Status: ${isOpen ? 'OPEN' : 'CLOSED'}`);
return isOpen;
```

---

## 🔄 Behavior Differences

### Testing Mode (Current)
- ✅ WebSocket active 24/7 (except weekends)
- ✅ Good for development and testing
- ⚠️ May consume more API quota
- ⚠️ May receive limited data outside market hours

### Production Mode
- ✅ WebSocket active only during market hours (9:15 AM - 3:30 PM IST)
- ✅ REST API polling outside market hours
- ✅ Conserves API quota
- ✅ Matches actual market trading hours

---

## 📊 Market Hours Reference

### Indian Stock Market (NSE/BSE)
- **Pre-market**: 9:00 AM - 9:15 AM IST
- **Regular Trading**: 9:15 AM - 3:30 PM IST
- **Post-market**: 3:40 PM - 4:00 PM IST
- **Trading Days**: Monday - Friday (excluding public holidays)

### Currency Market (NSE Currency)
- **Trading Hours**: 9:00 AM - 5:00 PM IST
- **Trading Days**: Monday - Friday

### Commodity Market (MCX)
- **Trading Hours**: 9:00 AM - 11:30 PM IST (varies by commodity)
- **Trading Days**: Monday - Friday

---

## 🛠️ Advanced Configuration

### Custom Market Hours

If you want to support different market segments with different hours, you can modify the `isMarketOpen()` function:

```javascript
function isMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60;
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (istOffset * 60000));
    
    const day = istTime.getDay();
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    // Weekend check
    if (day === 0 || day === 6) return false;
    
    // Equity market: 9:15 AM - 3:30 PM
    const equityOpen = 9 * 60 + 15;
    const equityClose = 15 * 60 + 30;
    
    // Currency market: 9:00 AM - 5:00 PM
    const currencyOpen = 9 * 60;
    const currencyClose = 17 * 60;
    
    // Commodity market: 9:00 AM - 11:30 PM
    const commodityOpen = 9 * 60;
    const commodityClose = 23 * 60 + 30;
    
    // Return true if any market is open
    return (timeInMinutes >= equityOpen && timeInMinutes <= equityClose) ||
           (timeInMinutes >= currencyOpen && timeInMinutes <= currencyClose) ||
           (timeInMinutes >= commodityOpen && timeInMinutes <= commodityClose);
}
```

---

## 🔐 Security Considerations

### API Token Management

1. **Token Expiry**: DhanHQ access tokens expire after ~24 hours
2. **Manual Refresh**: Currently requires manual token refresh in Settings
3. **Storage**: Tokens stored in SQLite database (not encrypted)

### Recommendations for Production

1. **Environment Variables**: Store sensitive credentials in environment variables
2. **Token Encryption**: Encrypt tokens before storing in database
3. **Auto Refresh**: Implement automatic token refresh mechanism
4. **HTTPS**: Use HTTPS in production (currently HTTP for development)
5. **Rate Limiting**: Implement client-side rate limiting to avoid API quota exhaustion

---

## 📈 Performance Optimization

### WebSocket Connection Pool
For multiple users, consider implementing a connection pool:

```javascript
// Pseudo-code
class WebSocketPool {
    constructor(maxConnections = 5) {
        this.connections = [];
        this.maxConnections = maxConnections;
    }
    
    getConnection(userId) {
        // Reuse existing connection or create new one
        // DhanHQ allows up to 5 WebSocket connections per user
    }
}
```

### Data Caching
Implement Redis or in-memory caching for:
- Instrument master data
- Historical prices
- User watchlists

---

## 🐛 Troubleshooting

### WebSocket Not Connecting

1. **Check API Credentials**: Verify access token and client ID in Settings
2. **Check Market Hours**: Ensure market is open (or testing mode is enabled)
3. **Check Console Logs**: Open browser console (F12) and look for errors
4. **Check Network**: Verify WebSocket connection in Network tab (WS filter)

### Prices Not Updating

1. **Check Instrument Status**: Inactive instruments will show "--"
2. **Check Subscription**: Look for "Subscribed" status in console logs
3. **Check Binary Parsing**: Verify ticker packets are being received and parsed
4. **Check Rate Limits**: Look for 429 errors in console

### Connection Dropping

1. **Check Heartbeat**: Verify heartbeat monitoring is working
2. **Check Token Expiry**: Refresh access token if expired
3. **Check Network Stability**: Verify internet connection is stable
4. **Check DhanHQ Status**: Verify DhanHQ API is operational

---

## 📦 Deployment Checklist

- [ ] Switch to Production Mode (restore normal market hours)
- [ ] Set up HTTPS with SSL certificate
- [ ] Configure environment variables for sensitive data
- [ ] Set up database backups
- [ ] Implement logging and monitoring
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure rate limiting
- [ ] Set up auto-restart for server crashes
- [ ] Test with real market data during trading hours
- [ ] Document API usage and quota limits
- [ ] Set up alerts for API errors and downtime

---

## 🔄 Maintenance

### Daily Tasks
- Monitor API quota usage
- Check for token expiry
- Review error logs

### Weekly Tasks
- Update instrument master data
- Review and optimize database queries
- Check WebSocket connection stability

### Monthly Tasks
- Update DhanHQ API client library (if available)
- Review and optimize code
- Update documentation

---

## 📞 Support Resources

- **DhanHQ API Docs**: https://dhanhq.co/docs/
- **DhanHQ Support**: https://dhanhq.co/support/
- **WebSocket RFC**: https://tools.ietf.org/html/rfc6455

---

**Last Updated**: October 20, 2025
**Version**: 1.0.0

