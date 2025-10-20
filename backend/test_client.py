"""
Test client to verify WebSocket price distribution
"""

import asyncio
import websockets
import json

async def test_client():
    uri = "ws://localhost:8765"
    
    print(f"[Client] Connecting to {uri}...")
    
    async with websockets.connect(uri) as websocket:
        print("[Client] Connected!")
        
        # Subscribe to Reliance (BSE_EQ, 500325)
        subscription = {
            "type": "subscribe",
            "instruments": [
                {
                    "exchangeSegment": "BSE_EQ",
                    "securityId": "500325"
                }
            ]
        }
        
        print(f"[Client] Sending subscription: {subscription}")
        await websocket.send(json.dumps(subscription))
        
        # Receive messages
        print("[Client] Waiting for messages...")
        async for message in websocket:
            data = json.loads(message)
            print(f"[Client] Received: {data}")
            
            # Stop after receiving 5 ticker messages
            if data.get('type') == 'ticker':
                print(f"[Client] Ticker: {data['securityId']} = ₹{data['ltp']}")

if __name__ == "__main__":
    asyncio.run(test_client())

