from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import csv
import io
from datetime import datetime
import os

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
    
    # Create indexes for faster search
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_trading_symbol ON instruments(trading_symbol)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_display_name ON instruments(display_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_exchange ON instruments(exchange)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_segment ON instruments(segment)')
    
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

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
    
    # Split query into tokens for fuzzy search
    tokens = query.upper().split()
    
    # Build WHERE clause with AND logic for all tokens
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
    
    query_sql = f'''
        SELECT * FROM instruments 
        WHERE {where_clause}
        LIMIT ?
    '''
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
            data.get('security_id'),
            data.get('exchange'),
            data.get('segment'),
            data.get('instrument_name'),
            data.get('trading_symbol'),
            data.get('display_name'),
            data.get('lot_size'),
            data.get('expiry_date'),
            data.get('strike_price'),
            data.get('option_type'),
            data.get('tick_size'),
            data.get('expiry_flag'),
            data.get('instrument_type'),
            data.get('series'),
            data.get('symbol_name')
        ))
        conn.commit()
        instrument_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': instrument_id, 'message': 'Instrument created successfully'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Instrument with this security ID already exists'}), 400

@app.route('/api/instruments/<int:instrument_id>', methods=['PUT'])
def update_instrument(instrument_id):
    data = request.json
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE instruments SET
            security_id = ?,
            exchange = ?,
            segment = ?,
            instrument_name = ?,
            trading_symbol = ?,
            display_name = ?,
            lot_size = ?,
            expiry_date = ?,
            strike_price = ?,
            option_type = ?,
            tick_size = ?,
            expiry_flag = ?,
            instrument_type = ?,
            series = ?,
            symbol_name = ?
        WHERE id = ?
    ''', (
        data.get('security_id'),
        data.get('exchange'),
        data.get('segment'),
        data.get('instrument_name'),
        data.get('trading_symbol'),
        data.get('display_name'),
        data.get('lot_size'),
        data.get('expiry_date'),
        data.get('strike_price'),
        data.get('option_type'),
        data.get('tick_size'),
        data.get('expiry_flag'),
        data.get('instrument_type'),
        data.get('series'),
        data.get('symbol_name'),
        instrument_id
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Instrument updated successfully'})

@app.route('/api/instruments/<int:instrument_id>', methods=['DELETE'])
def delete_instrument(instrument_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM instruments WHERE id = ?', (instrument_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Instrument deleted successfully'})

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
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400
    
    try:
        # Read CSV file
        stream = io.StringIO(file.stream.read().decode('UTF8'), newline=None)
        csv_reader = csv.DictReader(stream)
        
        conn = get_db()
        cursor = conn.cursor()
        
        inserted = 0
        updated = 0
        
        for row in csv_reader:
            security_id = row.get('SEM_SMST_SECURITY_ID', '')
            
            if not security_id:
                continue
            
            # Parse expiry date
            expiry_date = row.get('SEM_EXPIRY_DATE', '')
            if expiry_date and expiry_date != '-0.01000':
                try:
                    expiry_date = datetime.strptime(expiry_date, '%Y-%m-%d %H:%M:%S').strftime('%Y-%m-%d')
                except:
                    expiry_date = None
            else:
                expiry_date = None
            
            # Parse numeric fields
            try:
                lot_size = float(row.get('SEM_LOT_UNITS', 0) or 0)
            except:
                lot_size = 0
            
            try:
                strike_price = float(row.get('SEM_STRIKE_PRICE', 0) or 0)
            except:
                strike_price = 0
            
            try:
                tick_size = float(row.get('SEM_TICK_SIZE', 0) or 0)
            except:
                tick_size = 0
            
            try:
                cursor.execute('''
                    INSERT INTO instruments (
                        security_id, exchange, segment, instrument_name,
                        trading_symbol, display_name, lot_size, expiry_date,
                        strike_price, option_type, tick_size, expiry_flag,
                        instrument_type, series, symbol_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    security_id,
                    row.get('SEM_EXM_EXCH_ID', ''),
                    row.get('SEM_SEGMENT', ''),
                    row.get('SEM_INSTRUMENT_NAME', ''),
                    row.get('SEM_TRADING_SYMBOL', ''),
                    row.get('SEM_CUSTOM_SYMBOL', ''),
                    lot_size,
                    expiry_date,
                    strike_price,
                    row.get('SEM_OPTION_TYPE', ''),
                    tick_size,
                    row.get('SEM_EXPIRY_FLAG', ''),
                    row.get('SEM_EXCH_INSTRUMENT_TYPE', ''),
                    row.get('SEM_SERIES', ''),
                    row.get('SM_SYMBOL_NAME', '')
                ))
                inserted += 1
            except sqlite3.IntegrityError:
                # Update existing record
                cursor.execute('''
                    UPDATE instruments SET
                        exchange = ?,
                        segment = ?,
                        instrument_name = ?,
                        trading_symbol = ?,
                        display_name = ?,
                        lot_size = ?,
                        expiry_date = ?,
                        strike_price = ?,
                        option_type = ?,
                        tick_size = ?,
                        expiry_flag = ?,
                        instrument_type = ?,
                        series = ?,
                        symbol_name = ?
                    WHERE security_id = ?
                ''', (
                    row.get('SEM_EXM_EXCH_ID', ''),
                    row.get('SEM_SEGMENT', ''),
                    row.get('SEM_INSTRUMENT_NAME', ''),
                    row.get('SEM_TRADING_SYMBOL', ''),
                    row.get('SEM_CUSTOM_SYMBOL', ''),
                    lot_size,
                    expiry_date,
                    strike_price,
                    row.get('SEM_OPTION_TYPE', ''),
                    tick_size,
                    row.get('SEM_EXPIRY_FLAG', ''),
                    row.get('SEM_EXCH_INSTRUMENT_TYPE', ''),
                    row.get('SEM_SERIES', ''),
                    row.get('SM_SYMBOL_NAME', ''),
                    security_id
                ))
                updated += 1
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'CSV uploaded successfully',
            'inserted': inserted,
            'updated': updated
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)

