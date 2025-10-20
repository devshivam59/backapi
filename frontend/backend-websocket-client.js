/**
 * Backend WebSocket Client
 * Connects to backend WebSocket server instead of directly to DhanHQ
 * Backend manages DhanHQ connection and distributes prices to all clients
 */

class BackendWebSocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.subscribed = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 50;
        this.reconnectDelay = 2000;
        this.heartbeatInterval = null;
        this.onConnectionStatus = null;
        this.onTicker = null;
        
        // Get WebSocket URL (use current host)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        this.wsUrl = `${protocol}//${host}:8765`;
        
        console.log(`[BackendWS] WebSocket URL: ${this.wsUrl}`);
    }
    
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[BackendWS] Already connected');
            return;
        }
        
        console.log(`[BackendWS] Connecting to backend...`);
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('[BackendWS] Connected to backend');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.updateStatus('Connected');
                this.startHeartbeat();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('[BackendWS] Failed to parse message:', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('[BackendWS] WebSocket error:', error);
                this.updateStatus('Error');
            };
            
            this.ws.onclose = () => {
                console.log('[BackendWS] Connection closed');
                this.connected = false;
                this.subscribed = false;
                this.stopHeartbeat();
                this.updateStatus('Disconnected');
                this.reconnect();
            };
            
        } catch (error) {
            console.error('[BackendWS] Connection failed:', error);
            this.updateStatus('Error');
            this.reconnect();
        }
    }
    
    handleMessage(data) {
        console.log('[BackendWS] Message:', data);
        
        switch (data.type) {
            case 'status':
                console.log('[BackendWS] Status:', data.message);
                break;
                
            case 'subscribed':
                console.log(`[BackendWS] Subscribed to ${data.count} instruments`);
                this.subscribed = true;
                this.updateStatus('Subscribed');
                break;
                
            case 'ticker':
                // Forward ticker data to callback
                if (this.onTicker) {
                    this.onTicker({
                        securityId: data.securityId,
                        ltp: data.ltp,
                        ltt: data.ltt,
                        exchangeSegment: data.exchangeSegment
                    });
                }
                break;
                
            case 'pong':
                // Heartbeat response
                break;
                
            default:
                console.warn('[BackendWS] Unknown message type:', data.type);
        }
    }
    
    subscribe(instruments) {
        if (!this.connected) {
            console.error('[BackendWS] Not connected, cannot subscribe');
            return false;
        }
        
        console.log(`[BackendWS] Subscribing to ${instruments.length} instruments`);
        
        const message = {
            type: 'subscribe',
            instruments: instruments
        };
        
        this.send(message);
        return true;
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        } else {
            console.error('[BackendWS] Cannot send, not connected');
            return false;
        }
    }
    
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.connected) {
                this.send({ type: 'ping' });
            }
        }, 30000); // 30 seconds
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[BackendWS] Max reconnection attempts reached');
            this.updateStatus('Failed');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);
        
        console.log(`[BackendWS] Reconnecting in ${delay/1000}s (attempt ${this.reconnectAttempts})`);
        this.updateStatus('Reconnecting');
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    updateStatus(status) {
        if (this.onConnectionStatus) {
            this.onConnectionStatus(status);
        }
    }
    
    disconnect() {
        console.log('[BackendWS] Disconnecting...');
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.subscribed = false;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackendWebSocketClient;
}

