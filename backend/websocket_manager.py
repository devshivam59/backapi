"""
WebSocket Manager for DhanHQ Integration
Manages single connection to DhanHQ and distributes prices to multiple clients
"""

import asyncio
import websockets
import json
import struct
import time
from datetime import datetime
from typing import Dict, Set, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DhanHQWebSocketManager:
    """Manages WebSocket connection to DhanHQ and price distribution to clients"""
    
    def __init__(self, access_token: str, client_id: str):
        self.access_token = access_token
        self.client_id = client_id
        self.dhan_ws = None
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.subscriptions: Dict[str, Set[websockets.WebSocketServerProtocol]] = {}
        self.subscribed_instruments: Set[tuple] = set()  # (exchange_segment, security_id)
        self.running = False
        self.heartbeat_task = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 50
        
    async def connect_to_dhan(self):
        """Establish WebSocket connection to DhanHQ"""
        try:
            logger.info("[DhanHQ] Connecting to DhanHQ WebSocket...")
            
            # DhanHQ WebSocket URL with query parameters
            url = f"wss://api-feed.dhan.co?version=2&token={self.access_token}&clientId={self.client_id}&authType=2"
            
            self.dhan_ws = await websockets.connect(url)
            logger.info("[DhanHQ] Connected successfully!")
            
            self.reconnect_attempts = 0
            return True
            
        except Exception as e:
            logger.error(f"[DhanHQ] Connection failed: {e}")
            return False
    
    async def subscribe_to_instruments(self, instruments: List[Dict]):
        """Subscribe to instruments on DhanHQ WebSocket"""
        if not self.dhan_ws:
            logger.error("[DhanHQ] Not connected, cannot subscribe")
            return False
        
        try:
            # Prepare subscription request
            subscription_request = {
                "RequestCode": 15,  # Ticker mode
                "InstrumentCount": len(instruments),
                "InstrumentList": instruments
            }
            
            logger.info(f"[DhanHQ] Subscribing to {len(instruments)} instruments")
            logger.debug(f"[DhanHQ] Subscription request: {subscription_request}")
            
            # Send subscription request
            await self.dhan_ws.send(json.dumps(subscription_request))
            
            # Update subscribed instruments
            for inst in instruments:
                key = (inst['ExchangeSegment'], str(inst['SecurityId']))
                self.subscribed_instruments.add(key)
            
            logger.info(f"[DhanHQ] Subscription sent for {len(instruments)} instruments")
            return True
            
        except Exception as e:
            logger.error(f"[DhanHQ] Subscription failed: {e}")
            return False
    
    async def handle_dhan_messages(self):
        """Receive and process messages from DhanHQ"""
        try:
            while self.running and self.dhan_ws:
                try:
                    message = await asyncio.wait_for(self.dhan_ws.recv(), timeout=60)
                    
                    # Check if binary (ticker data) or text (status message)
                    if isinstance(message, bytes):
                        await self.process_ticker_data(message)
                    else:
                        await self.process_text_message(message)
                        
                except asyncio.TimeoutError:
                    logger.warning("[DhanHQ] No message received for 60s, connection may be stale")
                    continue
                except websockets.exceptions.ConnectionClosed:
                    logger.error("[DhanHQ] Connection closed by server")
                    break
                    
        except Exception as e:
            logger.error(f"[DhanHQ] Message handling error: {e}")
        finally:
            await self.reconnect_to_dhan()
    
    async def process_ticker_data(self, data: bytes):
        """Parse binary ticker data from DhanHQ"""
        try:
            # DhanHQ ticker packet format (17 bytes):
            # Response Header (8 bytes) + LTP (4 bytes float32) + LTT (4 bytes int32) + padding (1 byte)
            
            if len(data) < 17:
                logger.warning(f"[DhanHQ] Invalid ticker packet size: {len(data)}")
                return
            
            # Parse response header (8 bytes)
            response_code = struct.unpack('B', data[0:1])[0]  # Should be 2 for ticker
            message_length = struct.unpack('<H', data[1:3])[0]
            exchange_segment = struct.unpack('B', data[3:4])[0]
            security_id = struct.unpack('<I', data[4:8])[0]
            
            # Parse ticker data
            ltp = struct.unpack('<f', data[8:12])[0]  # float32
            ltt = struct.unpack('<I', data[12:16])[0]  # int32
            
            # Create ticker object
            ticker = {
                'type': 'ticker',
                'exchangeSegment': exchange_segment,
                'securityId': str(security_id),
                'ltp': round(ltp, 2),
                'ltt': ltt,
                'timestamp': int(time.time() * 1000)
            }
            
            logger.debug(f"[DhanHQ] Ticker: {ticker['securityId']} = ₹{ticker['ltp']}")
            
            # Broadcast to subscribed clients
            await self.broadcast_to_clients(ticker)
            
        except Exception as e:
            logger.error(f"[DhanHQ] Ticker parsing error: {e}")
    
    async def process_text_message(self, message: str):
        """Process text messages from DhanHQ (status, errors, etc.)"""
        try:
            data = json.loads(message)
            logger.info(f"[DhanHQ] Status message: {data}")
            
            # Broadcast status to clients
            status_msg = {
                'type': 'status',
                'message': data
            }
            await self.broadcast_to_clients(status_msg)
            
        except json.JSONDecodeError:
            logger.warning(f"[DhanHQ] Non-JSON text message: {message}")
    
    async def broadcast_to_clients(self, message: dict):
        """Broadcast message to all connected clients"""
        if not self.clients:
            return
        
        # Convert to JSON
        message_json = json.dumps(message)
        
        # Send to all clients
        disconnected_clients = set()
        for client in self.clients:
            try:
                await client.send(message_json)
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.add(client)
            except Exception as e:
                logger.error(f"[Broadcast] Error sending to client: {e}")
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        for client in disconnected_clients:
            await self.remove_client(client)
    
    async def add_client(self, websocket: websockets.WebSocketServerProtocol):
        """Add a new client connection"""
        self.clients.add(websocket)
        logger.info(f"[Clients] New client connected. Total: {len(self.clients)}")
        
        # Send connection status
        await websocket.send(json.dumps({
            'type': 'status',
            'message': 'Connected to price feed'
        }))
    
    async def remove_client(self, websocket: websockets.WebSocketServerProtocol):
        """Remove a client connection"""
        self.clients.discard(websocket)
        logger.info(f"[Clients] Client disconnected. Total: {len(self.clients)}")
        
        # Clean up client's subscriptions
        for instrument_key in list(self.subscriptions.keys()):
            self.subscriptions[instrument_key].discard(websocket)
            if not self.subscriptions[instrument_key]:
                del self.subscriptions[instrument_key]
    
    async def handle_client_subscription(self, websocket: websockets.WebSocketServerProtocol, instruments: List[Dict]):
        """Handle subscription request from a client"""
        try:
            logger.info(f"[Client] Subscription request for {len(instruments)} instruments")
            
            # Track which instruments this client wants
            for inst in instruments:
                key = f"{inst['exchangeSegment']}:{inst['securityId']}"
                if key not in self.subscriptions:
                    self.subscriptions[key] = set()
                self.subscriptions[key].add(websocket)
            
            # Check if we need to subscribe to new instruments on DhanHQ
            new_instruments = []
            for inst in instruments:
                dhan_key = (inst['exchangeSegment'], str(inst['securityId']))
                if dhan_key not in self.subscribed_instruments:
                    new_instruments.append({
                        'ExchangeSegment': inst['exchangeSegment'],
                        'SecurityId': int(inst['securityId'])
                    })
            
            # Subscribe to new instruments on DhanHQ
            if new_instruments:
                logger.info(f"[DhanHQ] Subscribing to {len(new_instruments)} new instruments")
                await self.subscribe_to_instruments(new_instruments)
            
            # Send confirmation to client
            await websocket.send(json.dumps({
                'type': 'subscribed',
                'count': len(instruments)
            }))
            
        except Exception as e:
            logger.error(f"[Client] Subscription error: {e}")
    
    async def reconnect_to_dhan(self):
        """Attempt to reconnect to DhanHQ"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("[DhanHQ] Max reconnection attempts reached")
            return
        
        self.reconnect_attempts += 1
        wait_time = min(5 * self.reconnect_attempts, 60)
        
        logger.info(f"[DhanHQ] Reconnecting in {wait_time}s (attempt {self.reconnect_attempts})")
        await asyncio.sleep(wait_time)
        
        if await self.connect_to_dhan():
            # Resubscribe to all instruments
            if self.subscribed_instruments:
                instruments = [
                    {'ExchangeSegment': seg, 'SecurityId': int(sid)}
                    for seg, sid in self.subscribed_instruments
                ]
                await self.subscribe_to_instruments(instruments)
            
            # Resume message handling
            asyncio.create_task(self.handle_dhan_messages())
    
    async def start(self):
        """Start the WebSocket manager"""
        self.running = True
        
        # Connect to DhanHQ
        if await self.connect_to_dhan():
            # Start message handler
            asyncio.create_task(self.handle_dhan_messages())
            logger.info("[Manager] WebSocket manager started")
        else:
            logger.error("[Manager] Failed to start - DhanHQ connection failed")
    
    async def stop(self):
        """Stop the WebSocket manager"""
        self.running = False
        
        # Close DhanHQ connection
        if self.dhan_ws:
            await self.dhan_ws.close()
        
        # Close all client connections
        for client in list(self.clients):
            await client.close()
        
        logger.info("[Manager] WebSocket manager stopped")

