# DhanHQ Instruments Manager

A full-stack web application for managing and searching DhanHQ trading instruments with CRUD operations and advanced fuzzy search capabilities.

## 🚀 Live Application

**Access URL:** https://5000-iytom3oluok7lib9x9jul-2ac7958e.manusvm.computer

## ✨ Features

### Core Functionality
- **CSV Upload**: Bulk import DhanHQ instruments from CSV files
- **Fuzzy Search**: Multi-token case-insensitive search across all fields
- **CRUD Operations**: Create, Read, Update, and Delete instruments
- **Real-time Search**: 300ms debounced search for optimal performance
- **Responsive UI**: Modern dark theme with Tailwind CSS

### Search Capabilities
- Search by **Security ID**
- Search by **Trading Symbol**
- Search by **Display Name**
- Search by **Exchange** (BSE, NSE, MCX)
- Search by **Segment** (E=Equity, D=Derivatives, C=Currency, M=Commodity)
- **Multi-token search**: "nse fut" finds all NSE futures

### Database
- **SQLite** database with indexed fields for fast queries
- **202,811 instruments** loaded from DhanHQ API
- Automatic upsert on CSV import (insert new, update existing)

## 📊 Current Data

- **Total Instruments**: 202,811
- **Data Source**: https://images.dhan.co/api-data/api-scrip-master.csv
- **Last Updated**: October 19, 2025

## 🔧 Technology Stack

### Backend
- **Python 3.11** with Flask framework
- **SQLite** database
- **Flask-CORS** for cross-origin requests
- RESTful API design

### Frontend
- **HTML5** with modern JavaScript (ES6+)
- **Tailwind CSS** for styling
- **Vanilla JavaScript** (no framework dependencies)
- Responsive design with dark theme

## 📁 Project Structure

```
dhanhq-app/
├── backend/
│   ├── server.py          # Flask application
│   └── requirements.txt   # Python dependencies
├── frontend/
│   └── index.html        # Single-page application
├── data/
│   ├── instruments.db    # SQLite database
│   └── dhanhq_full.csv   # Downloaded CSV data
└── README.md
```

## 🎯 API Endpoints

### GET /api/instruments
Get paginated list of instruments
- Query params: `limit` (default: 100), `offset` (default: 0)

### GET /api/instruments/search
Search instruments with fuzzy matching
- Query params: `query` (search term), `limit` (default: 100)

### GET /api/instruments/count
Get total count of instruments

### POST /api/instruments
Create a new instrument
- Body: JSON with instrument fields

### PUT /api/instruments/:id
Update an existing instrument
- Body: JSON with updated fields

### DELETE /api/instruments/:id
Delete a single instrument

### DELETE /api/instruments/bulk-delete
Delete all instruments

### POST /api/instruments/upload
Upload CSV file for bulk import
- Body: multipart/form-data with CSV file

## 🔍 Search Examples

1. **Simple search**: `nifty` → finds all NIFTY-related instruments
2. **Multi-token**: `nse fut` → finds NSE futures contracts
3. **Exchange filter**: `bse` → finds all BSE instruments
4. **Segment filter**: `d` → finds all derivatives

## 🎨 UI Features

- **Stats Dashboard**: Real-time count of total and filtered instruments
- **Quick Actions**: One-click CSV upload
- **Data Table**: Sortable columns with edit/delete actions
- **Modal Forms**: Clean interface for add/edit operations
- **Loading States**: Visual feedback during operations
- **Error Handling**: User-friendly error messages

## 🚦 How to Use

1. **Upload CSV**: Click "Upload CSV" button and select a DhanHQ CSV file
2. **Search**: Type in the search box (e.g., "nifty", "bse equity", "sensex")
3. **Add New**: Click "Add New" to manually create an instrument
4. **Edit**: Click the ✏️ icon next to any instrument
5. **Delete**: Click the 🗑️ icon to remove an instrument
6. **Bulk Delete**: Click "Delete All" to clear the database

## 📝 CSV Format

The application expects DhanHQ CSV format with these columns:
- `SEM_SMST_SECURITY_ID` - Unique security identifier
- `SEM_EXM_EXCH_ID` - Exchange (BSE/NSE/MCX)
- `SEM_SEGMENT` - Segment code
- `SEM_TRADING_SYMBOL` - Trading symbol
- `SEM_CUSTOM_SYMBOL` - Display name
- `SEM_LOT_UNITS` - Lot size
- `SEM_EXPIRY_DATE` - Expiry date (for derivatives)
- And other standard DhanHQ fields

## 🔐 Security Notes

- This is a development server (Flask built-in server)
- For production use, deploy with a WSGI server (gunicorn, uWSGI)
- Add authentication/authorization as needed
- Consider rate limiting for API endpoints

## 🛠️ Running Locally

```bash
# Install dependencies
cd backend
pip3 install -r requirements.txt

# Start server
python3 server.py

# Access at http://localhost:5000
```

## 📈 Performance

- **Search Response Time**: < 100ms for most queries
- **CSV Upload**: ~30 seconds for 200K+ records
- **Database Size**: ~150MB with full dataset
- **Indexed Fields**: trading_symbol, display_name, exchange, segment

## 🎓 Key Differences from Zerodha

1. **Field Names**: DhanHQ uses different column names (SEM_*, SM_*)
2. **Segment Codes**: Single letters (E, D, C, M) vs full names
3. **Display Names**: DhanHQ has user-friendly display symbols
4. **Security ID**: Numeric IDs instead of instrument tokens

## 📞 Support

For issues with DhanHQ API or CSV format, refer to:
- DhanHQ Documentation: https://dhanhq.co/docs/v2/instruments/
- CSV Download: https://images.dhan.co/api-data/api-scrip-master.csv

---

**Built with ❤️ for DhanHQ traders**

