from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import sqlite3
import csv
import io
from datetime import datetime

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

DATABASE = '/home/ubuntu/dhanhq-app/data/instruments.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS instruments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            security_id TEXT UNIQUE NOT NULL,
            exchange TEXT,
            segment TEXT,
            instrument_name TEXT,
            trading_symbol TEXT,
            display_name TEXT,
            lot_size REAL,
            expiry_date TEXT,
            strike_price REAL,
            option_type TEXT,
            tick_size REAL,
            expiry_flag TEXT,
            instrument_type TEXT,
            series TEXT,
            symbol_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_trading_symbol ON instruments(trading_symbol)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_display_name ON instruments(display_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_exchange ON instruments(exchange)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_segment ON instruments(segment)')
    
    # Create watchlist table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_token TEXT NOT NULL,
            security_id TEXT NOT NULL,
            exchange_segment TEXT NOT NULL,
            trading_symbol TEXT,
            display_name TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_token, security_id, exchange_segment)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_token ON watchlist(user_token)')
    
    # Create user settings table for API credentials
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            user_token TEXT PRIMARY KEY,
            access_token TEXT,
            client_id TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/watchlist.html')
def serve_watchlist():
    return send_file('../frontend/watchlist.html')

@app.route('/websocket-handler.js')
def serve_websocket_handler():
    return send_file('../frontend/websocket-handler.js', mimetype='application/javascript')

@app.route('/debug-console.html')
def serve_debug_console():
    return send_file('../frontend/debug-console.html')

@app.route('/api/instruments', methods=['GET'])
def get_instruments():
    conn = get_db()
    cursor = conn.cursor()
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    cursor.execute('SELECT * FROM instruments LIMIT ? OFFSET ?', (limit, offset))
    instruments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(instruments)

@app.route('/api/instruments/search', methods=['GET'])
def search_instruments():
    query = request.args.get('query', '').strip()
    limit = request.args.get('limit', 100, type=int)
    
    if not query:
        return jsonify([])
    
    conn = get_db()
    cursor = conn.cursor()
    tokens = query.upper().split()
    where_conditions = []
    params = []
    
    for token in tokens:
        pattern = f'%{token}%'
        where_conditions.append('''
            (UPPER(trading_symbol) LIKE ? OR 
             UPPER(display_name) LIKE ? OR 
             UPPER(symbol_name) LIKE ? OR 
             UPPER(instrument_name) LIKE ? OR 
             UPPER(exchange) LIKE ? OR 
             UPPER(segment) LIKE ?)
        ''')
        params.extend([pattern] * 6)
    
    where_clause = ' AND '.join(where_conditions)
    query_sql = f'SELECT * FROM instruments WHERE {where_clause} LIMIT ?'
    params.append(limit)
    
    cursor.execute(query_sql, params)
    instruments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(instruments)

@app.route('/api/instruments/count', methods=['GET'])
def count_instruments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM instruments')
    result = cursor.fetchone()
    conn.close()
    return jsonify({'count': result['count']})

@app.route('/api/instruments', methods=['POST'])
def create_instrument():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO instruments (
                security_id, exchange, segment, instrument_name,
                trading_symbol, display_name, lot_size, expiry_date,
                strike_price, option_type, tick_size, expiry_flag,
                instrument_type, series, symbol_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('security_id'), data.get('exchange'), data.get('segment'),
            data.get('instrument_name'), data.get('trading_symbol'), data.get('display_name'),
            data.get('lot_size'), data.get('expiry_date'), data.get('strike_price'),
            data.get('option_type'), data.get('tick_size'), data.get('expiry_flag'),
            data.get('instrument_type'), data.get('series'), data.get('symbol_name')
        ))
        conn.commit()
        instrument_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': instrument_id, 'message': 'Instrument created'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Security ID already exists'}), 400

@app.route('/api/instruments/<int:instrument_id>', methods=['PUT'])
def update_instrument(instrument_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE instruments SET
            security_id = ?, exchange = ?, segment = ?, instrument_name = ?,
            trading_symbol = ?, display_name = ?, lot_size = ?, expiry_date = ?,
            strike_price = ?, option_type = ?, tick_size = ?, expiry_flag = ?,
            instrument_type = ?, series = ?, symbol_name = ?
        WHERE id = ?
    ''', (
        data.get('security_id'), data.get('exchange'), data.get('segment'),
        data.get('instrument_name'), data.get('trading_symbol'), data.get('display_name'),
        data.get('lot_size'), data.get('expiry_date'), data.get('strike_price'),
        data.get('option_type'), data.get('tick_size'), data.get('expiry_flag'),
        data.get('instrument_type'), data.get('series'), data.get('symbol_name'),
        instrument_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Instrument updated'})

@app.route('/api/instruments/<int:instrument_id>', methods=['DELETE'])
def delete_instrument(instrument_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM instruments WHERE id = ?', (instrument_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Instrument deleted'})

@app.route('/api/instruments/bulk-delete', methods=['DELETE'])
def bulk_delete():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM instruments')
    conn.commit()
    count = cursor.rowcount
    conn.close()
    return jsonify({'message': f'Deleted {count} instruments'})

@app.route('/api/instruments/upload', methods=['POST'])
def upload_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '' or not file.filename.endswith('.csv'):
        return jsonify({'error': 'Invalid file'}), 400
    
    try:
        stream = io.StringIO(file.stream.read().decode('UTF8'), newline=None)
        csv_reader = csv.DictReader(stream)
        conn = get_db()
        cursor = conn.cursor()
        inserted = 0
        updated = 0
        errors = 0
        batch_size = 1000
        batch_count = 0
        
        # Use INSERT OR REPLACE for better performance
        insert_query = '''
            INSERT OR REPLACE INTO instruments (
                security_id, exchange, segment, instrument_name,
                trading_symbol, display_name, lot_size, expiry_date,
                strike_price, option_type, tick_size, expiry_flag,
                instrument_type, series, symbol_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        batch_data = []
        for row in csv_reader:
            # Support both standard and detailed CSV formats
            security_id = row.get('SEM_SMST_SECURITY_ID') or row.get('SECURITY_ID', '')
            if not security_id:
                continue
            
            # Get expiry date from either format
            expiry_date = row.get('SEM_EXPIRY_DATE') or row.get('SM_EXPIRY_DATE', '')
            if expiry_date and expiry_date != '-0.01000':
                try:
                    expiry_date = datetime.strptime(expiry_date, '%Y-%m-%d %H:%M:%S').strftime('%Y-%m-%d')
                except:
                    try:
                        expiry_date = datetime.strptime(expiry_date, '%Y-%m-%d').strftime('%Y-%m-%d')
                    except:
                        expiry_date = None
            else:
                expiry_date = None
            
            try:
                lot_size = float(row.get('SEM_LOT_UNITS') or row.get('LOT_SIZE') or 0)
                strike_price = float(row.get('SEM_STRIKE_PRICE') or row.get('STRIKE_PRICE') or 0)
                tick_size = float(row.get('SEM_TICK_SIZE') or row.get('TICK_SIZE') or 0)
            except:
                lot_size = strike_price = tick_size = 0
            
            # Map fields from either format
            exchange = row.get('SEM_EXM_EXCH_ID') or row.get('EXCH_ID', '')
            segment = row.get('SEM_SEGMENT') or row.get('SEGMENT', '')
            instrument_name = row.get('SEM_INSTRUMENT_NAME') or row.get('INSTRUMENT', '')
            trading_symbol = row.get('SEM_TRADING_SYMBOL') or row.get('SYMBOL_NAME', '')
            display_name = row.get('SEM_CUSTOM_SYMBOL') or row.get('DISPLAY_NAME', '')
            option_type = row.get('SEM_OPTION_TYPE') or row.get('OPTION_TYPE', '')
            expiry_flag = row.get('SEM_EXPIRY_FLAG') or row.get('EXPIRY_FLAG', '')
            instrument_type = row.get('SEM_EXCH_INSTRUMENT_TYPE') or row.get('INSTRUMENT_TYPE', '')
            series = row.get('SEM_SERIES') or row.get('SERIES', '')
            symbol_name = row.get('SM_SYMBOL_NAME') or row.get('SYMBOL_NAME', '')
            
            batch_data.append((
                security_id, exchange, segment, instrument_name,
                trading_symbol, display_name, lot_size, expiry_date,
                strike_price, option_type, tick_size, expiry_flag,
                instrument_type, series, symbol_name
            ))
            
            # Process in batches for better performance
            if len(batch_data) >= batch_size:
                try:
                    print(f"Attempting to insert batch {batch_count + 1} with {len(batch_data)} records")
                    print(f"Sample record: {batch_data[0] if batch_data else 'empty'}")
                    cursor.executemany(insert_query, batch_data)
                    conn.commit()
                    inserted += len(batch_data)
                    batch_count += 1
                    print(f"✅ Processed batch {batch_count}: {inserted} total records")
                except Exception as e:
                    errors += len(batch_data)
                    print(f"❌ Error processing batch: {e}")
                    print(f"First record in failed batch: {batch_data[0] if batch_data else 'empty'}")
                batch_data = []
        
        # Process remaining records
        if batch_data:
            try:
                print(f"Processing final batch with {len(batch_data)} records")
                print(f"Sample record: {batch_data[0] if batch_data else 'empty'}")
                cursor.executemany(insert_query, batch_data)
                conn.commit()
                inserted += len(batch_data)
                print(f"✅ Processed final batch: {len(batch_data)} records, total: {inserted}")
            except Exception as e:
                errors += len(batch_data)
                print(f"❌ Error processing final batch: {e}")
                print(f"First record in failed batch: {batch_data[0] if batch_data else 'empty'}")
        else:
            print("No remaining records to process")
        
        conn.close()
        print(f"Upload complete: inserted={inserted}, updated={updated}, errors={errors}")
        return jsonify({'message': 'CSV uploaded', 'inserted': inserted, 'updated': updated, 'errors': errors})
    except Exception as e:
        print(f"Upload failed: {e}")
        return jsonify({'error': str(e)}), 500

# Watchlist endpoints
@app.route('/api/watchlist', methods=['GET'])
def get_watchlist():
    user_token = request.headers.get('X-User-Token', 'default_user')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT w.*, i.lot_size, i.segment 
        FROM watchlist w 
        LEFT JOIN instruments i ON w.security_id = i.security_id 
        WHERE w.user_token = ? 
        ORDER BY w.added_at DESC
    ''', (user_token,))
    watchlist = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(watchlist)

@app.route('/api/watchlist', methods=['POST'])
def add_to_watchlist():
    user_token = request.headers.get('X-User-Token', 'default_user')
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO watchlist (user_token, security_id, exchange_segment, trading_symbol, display_name)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            user_token,
            data.get('security_id'),
            data.get('exchange_segment'),
            data.get('trading_symbol'),
            data.get('display_name')
        ))
        conn.commit()
        watchlist_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': watchlist_id, 'message': 'Added to watchlist'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Already in watchlist'}), 400

@app.route('/api/watchlist/<int:watchlist_id>', methods=['DELETE'])
def remove_from_watchlist(watchlist_id):
    user_token = request.headers.get('X-User-Token', 'default_user')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM watchlist WHERE id = ? AND user_token = ?', (watchlist_id, user_token))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Removed from watchlist'})

# User settings endpoints
@app.route('/api/settings', methods=['GET'])
def get_settings():
    user_token = request.headers.get('X-User-Token', 'default_user')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM user_settings WHERE user_token = ?', (user_token,))
    result = cursor.fetchone()
    conn.close()
    if result:
        return jsonify(dict(result))
    return jsonify({'user_token': user_token, 'access_token': None, 'client_id': None})

@app.route('/api/settings', methods=['POST'])
def save_settings():
    user_token = request.headers.get('X-User-Token', 'default_user')
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO user_settings (user_token, access_token, client_id, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ''', (user_token, data.get('access_token'), data.get('client_id')))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Settings saved'})

# Simple in-memory cache for API responses
from datetime import datetime, timedelta
import threading

price_cache = {}
cache_lock = threading.Lock()
CACHE_DURATION = 2  # Cache for 2 seconds

# Create a session for connection pooling
import requests
api_session = requests.Session()

# Market data proxy endpoint
@app.route('/api/market/ltp', methods=['POST'])
def get_market_ltp():
    user_token = request.headers.get('X-User-Token', 'default_user')
    
    # Get user's DhanHQ credentials
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT access_token, client_id FROM user_settings WHERE user_token = ?', (user_token,))
    result = cursor.fetchone()
    conn.close()
    
    if not result or not result['access_token']:
        return jsonify({'error': 'DhanHQ credentials not configured'}), 401
    
    access_token = result['access_token']
    client_id = result['client_id']
    
    # Create cache key from request data
    cache_key = f"{user_token}:{str(request.json)}"
    
    # Check cache
    with cache_lock:
        if cache_key in price_cache:
            cached_data, cached_time = price_cache[cache_key]
            if datetime.now() - cached_time < timedelta(seconds=CACHE_DURATION):
                return jsonify(cached_data), 200
    
    # Forward request to DhanHQ API with optimized timeout
    try:
        response = api_session.post(
            'https://api.dhan.co/v2/marketfeed/ltp',
            json=request.json,
            headers={
                'access-token': access_token,
                'client-id': client_id,
                'Content-Type': 'application/json'
            },
            timeout=3  # Reduced from 10s to 3s
        )
        
        if response.status_code == 200:
            result_data = response.json()
            # Cache the successful response
            with cache_lock:
                price_cache[cache_key] = (result_data, datetime.now())
                # Clean old cache entries (keep only last 100)
                if len(price_cache) > 100:
                    oldest_key = min(price_cache.keys(), key=lambda k: price_cache[k][1])
                    del price_cache[oldest_key]
            return jsonify(result_data), 200
        else:
            return jsonify(response.json()), response.status_code
            
    except requests.Timeout:
        return jsonify({'error': 'DhanHQ API timeout'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# PAPER TRADING API ENDPOINTS
# ============================================

# Get user account info
@app.route('/api/user/account', methods=['GET'])
def get_user_account():
    user_token = request.headers.get('X-User-Token', 'user_test123')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get or create user
        cursor.execute('SELECT * FROM users WHERE user_token = ?', (user_token,))
        user = cursor.fetchone()
        
        if not user:
            # Create new user with ₹10 Lakhs
            cursor.execute('''
                INSERT INTO users (user_token, virtual_funds_available, virtual_funds_used)
                VALUES (?, 1000000.00, 0.00)
            ''', (user_token,))
            conn.commit()
            cursor.execute('SELECT * FROM users WHERE user_token = ?', (user_token,))
            user = cursor.fetchone()
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'data': {
                'user_id': user['user_id'],
                'funds_available': float(user['virtual_funds_available']),
                'funds_used': float(user['virtual_funds_used']),
                'total_funds': 1000000.00
            }
        })
    except Exception as e:
        print(f"Error getting user account: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Place order
@app.route('/api/orders', methods=['POST'])
def place_order():
    user_token = request.headers.get('X-User-Token', 'user_test123')
    data = request.json
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get user
        cursor.execute('SELECT * FROM users WHERE user_token = ?', (user_token,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        user_id = user['user_id']
        funds_available = float(user['virtual_funds_available'])
        
        # Extract order details
        security_id = data.get('security_id')
        instrument_symbol = data.get('instrument_symbol')
        exchange_segment = data.get('exchange_segment')
        side = data.get('side')  # BUY or SELL
        product_type = data.get('product_type')  # INTRADAY or DELIVERY
        order_type = data.get('order_type')  # MARKET or LIMIT
        quantity = int(data.get('quantity'))
        limit_price = data.get('limit_price')
        current_ltp = float(data.get('current_ltp', 0))
        
        # Validate inputs
        if not all([security_id, instrument_symbol, exchange_segment, side, product_type, order_type, quantity]):
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400
        
        # For MARKET orders, use current LTP as execution price
        if order_type == 'MARKET':
            executed_price = current_ltp
        else:
            # For LIMIT orders, check if limit price is met (simplified for paper trading)
            executed_price = float(limit_price) if limit_price else current_ltp
        
        # Calculate order value
        order_value = executed_price * quantity
        
        # Validate funds for BUY orders
        if side == 'BUY':
            if order_value > funds_available:
                return jsonify({
                    'status': 'error',
                    'message': f'Insufficient funds. ₹{order_value:.2f} required, ₹{funds_available:.2f} available'
                }), 400
        
        # For SELL orders, check if position exists
        if side == 'SELL':
            cursor.execute('''
                SELECT * FROM positions 
                WHERE user_id = ? AND security_id = ? AND exchange_segment = ? AND product_type = ?
            ''', (user_id, security_id, exchange_segment, product_type))
            position = cursor.fetchone()
            
            if not position or position['quantity'] < quantity:
                available_qty = position['quantity'] if position else 0
                return jsonify({
                    'status': 'error',
                    'message': f'Insufficient quantity. {quantity} required, {available_qty} available'
                }), 400
        
        # Execute the order
        cursor.execute('''
            INSERT INTO orders (
                user_id, user_token, security_id, instrument_symbol, exchange_segment,
                side, product_type, order_type, quantity, limit_price, executed_price,
                status, executed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EXECUTED', CURRENT_TIMESTAMP)
        ''', (user_id, user_token, security_id, instrument_symbol, exchange_segment,
              side, product_type, order_type, quantity, limit_price, executed_price))
        
        order_id = cursor.lastrowid
        
        # Update position
        if side == 'BUY':
            # Deduct funds
            cursor.execute('''
                UPDATE users 
                SET virtual_funds_available = virtual_funds_available - ?,
                    virtual_funds_used = virtual_funds_used + ?
                WHERE user_id = ?
            ''', (order_value, order_value, user_id))
            
            # Check if position exists
            cursor.execute('''
                SELECT * FROM positions 
                WHERE user_id = ? AND security_id = ? AND exchange_segment = ? AND product_type = ?
            ''', (user_id, security_id, exchange_segment, product_type))
            position = cursor.fetchone()
            
            if position:
                # Update existing position (weighted average)
                old_qty = position['quantity']
                old_avg = float(position['average_price'])
                new_qty = old_qty + quantity
                new_avg = ((old_qty * old_avg) + (quantity * executed_price)) / new_qty
                
                cursor.execute('''
                    UPDATE positions 
                    SET quantity = ?, average_price = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE position_id = ?
                ''', (new_qty, new_avg, position['position_id']))
            else:
                # Create new position
                cursor.execute('''
                    INSERT INTO positions (
                        user_id, user_token, security_id, instrument_symbol, exchange_segment,
                        product_type, quantity, average_price
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, user_token, security_id, instrument_symbol, exchange_segment,
                      product_type, quantity, executed_price))
        
        else:  # SELL
            # Add funds
            cursor.execute('''
                UPDATE users 
                SET virtual_funds_available = virtual_funds_available + ?,
                    virtual_funds_used = virtual_funds_used - ?
                WHERE user_id = ?
            ''', (order_value, order_value, user_id))
            
            # Update position
            cursor.execute('''
                SELECT * FROM positions 
                WHERE user_id = ? AND security_id = ? AND exchange_segment = ? AND product_type = ?
            ''', (user_id, security_id, exchange_segment, product_type))
            position = cursor.fetchone()
            
            new_qty = position['quantity'] - quantity
            
            if new_qty == 0:
                # Close position
                cursor.execute('DELETE FROM positions WHERE position_id = ?', (position['position_id'],))
            else:
                # Reduce quantity
                cursor.execute('''
                    UPDATE positions 
                    SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE position_id = ?
                ''', (new_qty, position['position_id']))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': f'Order {side} executed successfully',
            'data': {
                'order_id': order_id,
                'executed_price': executed_price,
                'order_value': order_value
            }
        })
        
    except Exception as e:
        print(f"Error placing order: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Get user positions
@app.route('/api/positions', methods=['GET'])
def get_positions():
    user_token = request.headers.get('X-User-Token', 'user_test123')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT p.*, i.display_name, i.trading_symbol
            FROM positions p
            LEFT JOIN instruments i ON p.security_id = i.security_id
            WHERE p.user_token = ?
            ORDER BY p.updated_at DESC
        ''', (user_token,))
        
        positions = []
        for row in cursor.fetchall():
            positions.append({
                'position_id': row['position_id'],
                'security_id': row['security_id'],
                'instrument_symbol': row['instrument_symbol'],
                'display_name': row['display_name'],
                'trading_symbol': row['trading_symbol'],
                'exchange_segment': row['exchange_segment'],
                'product_type': row['product_type'],
                'quantity': row['quantity'],
                'average_price': float(row['average_price'])
            })
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'data': positions
        })
        
    except Exception as e:
        print(f"Error getting positions: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Get user orders
@app.route('/api/orders', methods=['GET'])
def get_orders():
    user_token = request.headers.get('X-User-Token', 'user_test123')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM orders
            WHERE user_token = ?
            ORDER BY created_at DESC
            LIMIT 100
        ''', (user_token,))
        
        orders = []
        for row in cursor.fetchall():
            orders.append({
                'order_id': row['order_id'],
                'security_id': row['security_id'],
                'instrument_symbol': row['instrument_symbol'],
                'exchange_segment': row['exchange_segment'],
                'side': row['side'],
                'product_type': row['product_type'],
                'order_type': row['order_type'],
                'quantity': row['quantity'],
                'limit_price': float(row['limit_price']) if row['limit_price'] else None,
                'executed_price': float(row['executed_price']) if row['executed_price'] else None,
                'status': row['status'],
                'created_at': row['created_at'],
                'executed_at': row['executed_at']
            })
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'data': orders
        })
        
    except Exception as e:
        print(f"Error getting orders: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)

