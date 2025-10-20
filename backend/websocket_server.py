"""
WebSocket Server for Price Distribution
Runs alongside Flask server to handle WebSocket connections
"""

import asyncio
import websockets
import json
import sqlite3
import logging
from websocket_manager import DhanHQWebSocketManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global WebSocket manager instance
ws_manager = None

def get_dhan_credentials():
    """Fetch DhanHQ credentials from database"""
    try:
        conn = sqlite3.connect('../data/instruments.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT access_token, client_id 
            FROM user_settings 
            WHERE user_token = 'user_test123'
            LIMIT 1
        ''')
        
        result = cursor.fetchone()
        conn.close()
        
        if result and result[0] and result[1]:
            return result[0], result[1]
        else:
            logger.warning("[Credentials] No DhanHQ credentials found in database")
            return None, None
            
    except Exception as e:
        logger.error(f"[Credentials] Error fetching credentials: {e}")
        return None, None

async def handle_client(websocket):
    """Handle individual client WebSocket connection"""
    global ws_manager
    
    try:
        # Add client to manager
        await ws_manager.add_client(websocket)
        
        # Handle client messages
        async for message in websocket:
            try:
                data = json.loads(message)
                
                # Handle subscription request
                if data.get('type') == 'subscribe':
                    instruments = data.get('instruments', [])
                    await ws_manager.handle_client_subscription(websocket, instruments)
                
                # Handle ping
                elif data.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
                
            except json.JSONDecodeError:
                logger.warning(f"[Client] Invalid JSON: {message}")
            except Exception as e:
                logger.error(f"[Client] Message handling error: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        logger.info("[Client] Connection closed")
    finally:
        # Remove client from manager
        await ws_manager.remove_client(websocket)

async def initialize_manager():
    """Initialize the WebSocket manager with DhanHQ credentials"""
    global ws_manager
    
    # Get credentials from database
    access_token, client_id = get_dhan_credentials()
    
    if not access_token or not client_id:
        logger.error("[Init] Cannot start - missing DhanHQ credentials")
        logger.info("[Init] Please configure credentials in settings")
        # Create manager anyway to accept client connections
        ws_manager = DhanHQWebSocketManager("", "")
        return
    
    # Create WebSocket manager
    ws_manager = DhanHQWebSocketManager(access_token, client_id)
    
    # Start manager
    await ws_manager.start()
    
    logger.info("[Init] WebSocket manager initialized")

async def main():
    """Main entry point"""
    global ws_manager
    
    # Initialize manager
    await initialize_manager()
    
    # Start WebSocket server
    server = await websockets.serve(
        handle_client,
        "0.0.0.0",
        8765,
        ping_interval=20,
        ping_timeout=60
    )
    
    logger.info("[Server] WebSocket server started on ws://0.0.0.0:8765")
    
    # Keep server running
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[Server] Shutting down...")

