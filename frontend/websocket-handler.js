/**
 * DhanHQ WebSocket Handler with Binary Protocol Parser
 * Implements real-time market data streaming
 */

class DhanWebSocket {
    constructor(accessToken, clientId) {
        this.accessToken = accessToken;
        this.clientId = clientId;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 50; // Increased for persistent connection
        this.reconnectDelay = 2000; // Start with 2 seconds
        this.subscribedInstruments = new Map();
        this.onTickerUpdate = null;
        this.onQuoteUpdate = null;
        this.onConnectionStatus = null;
        this.isConnecting = false;
        this.shouldReconnect = true;
        this.lastMessageTime = null;
        this.heartbeatInterval = null;
        this.heartbeatTimeout = 60000; // 60 seconds - if no message, reconnect
    }

    /**
     * Connect to DhanHQ WebSocket
     */
    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            console.log('[WebSocket] Already connected or connecting');
            return;
        }

        this.isConnecting = true;
        const wsUrl = `wss://api-feed.dhan.co?version=2&token=${this.accessToken}&clientId=${this.clientId}&authType=2`;
        
        console.log('[WebSocket] Connecting to DhanHQ...');
        this.updateStatus('Connecting...');

        try {
            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer'; // Important: receive binary data as ArrayBuffer

            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
        } catch (error) {
            console.error('[WebSocket] Connection error:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket open event
     */
    handleOpen() {
        console.log('[WebSocket] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000;
        this.lastMessageTime = Date.now();
        this.updateStatus('Connected');

        // Start heartbeat monitoring
        this.startHeartbeat();

        // Subscribe to all instruments
        if (this.subscribedInstruments.size > 0) {
            this.resubscribeAll();
        }
    }

    /**
     * Handle incoming WebSocket messages (binary data)
     */
    handleMessage(event) {
        try {
            // Update last message time for heartbeat monitoring
            this.lastMessageTime = Date.now();
            
            const buffer = event.data;
            console.log('[WebSocket] Message received, size:', buffer.byteLength, 'bytes');
            
            // Parse binary data
            const packet = this.parseBinaryPacket(buffer);
            
            if (packet) {
                console.log('[WebSocket] Packet parsed - Response Code:', packet.responseCode, 'Security ID:', packet.securityId);
                
                // Route to appropriate handler based on response code
                switch (packet.responseCode) {
                    case 2: // Ticker packet
                        this.handleTickerPacket(packet);
                        break;
                    case 4: // Quote packet
                        this.handleQuotePacket(packet);
                        break;
                    case 6: // Previous close packet
                        this.handlePrevClosePacket(packet);
                        break;
                    case 8: // Full packet
                        this.handleFullPacket(packet);
                        break;
                    default:
                        console.log('[WebSocket] Unknown response code:', packet.responseCode);
                }
            }
        } catch (error) {
            console.error('[WebSocket] Message parse error:', error);
        }
    }

    /**
     * Parse binary packet header (8 bytes)
     */
    parseBinaryPacket(buffer) {
        if (buffer.byteLength < 8) {
            console.warn('[WebSocket] Packet too small:', buffer.byteLength);
            return null;
        }

        const view = new DataView(buffer);
        
        // Parse header (8 bytes)
        const responseCode = view.getUint8(0);
        const messageLength = view.getUint16(1, true); // Little endian
        const exchangeSegment = view.getUint8(3);
        const securityId = view.getUint32(4, true); // Little endian

        return {
            responseCode,
            messageLength,
            exchangeSegment,
            securityId,
            buffer,
            view
        };
    }

    /**
     * Handle Ticker packet (Response Code: 2)
     * 17 bytes total: 8 bytes header + 4 bytes LTP + 4 bytes LTT + 1 byte padding
     */
    handleTickerPacket(packet) {
        const { view, securityId } = packet;
        
        const ltp = view.getFloat32(8, true); // Bytes 9-12
        const ltt = view.getUint32(12, true); // Bytes 13-16

        const tickerData = {
            securityId: securityId.toString(),
            ltp: ltp,
            ltt: new Date(ltt * 1000),
            timestamp: new Date()
        };

        console.log('[WebSocket] Ticker:', tickerData);

        if (this.onTickerUpdate) {
            this.onTickerUpdate(tickerData);
        }
    }

    /**
     * Handle Quote packet (Response Code: 4)
     * 51 bytes total: 8 bytes header + 43 bytes payload
     */
    handleQuotePacket(packet) {
        const { view, securityId } = packet;
        
        const quoteData = {
            securityId: securityId.toString(),
            ltp: view.getFloat32(8, true),
            ltq: view.getUint16(12, true),
            ltt: new Date(view.getUint32(14, true) * 1000),
            atp: view.getFloat32(18, true),
            volume: view.getUint32(22, true),
            totalSellQty: view.getUint32(26, true),
            totalBuyQty: view.getUint32(30, true),
            open: view.getFloat32(34, true),
            close: view.getFloat32(38, true),
            high: view.getFloat32(42, true),
            low: view.getFloat32(46, true),
            timestamp: new Date()
        };

        console.log('[WebSocket] Quote:', quoteData);

        if (this.onQuoteUpdate) {
            this.onQuoteUpdate(quoteData);
        }
    }

    /**
     * Handle Previous Close packet (Response Code: 6)
     */
    handlePrevClosePacket(packet) {
        const { view, securityId } = packet;
        
        const prevClose = view.getFloat32(8, true);
        const prevOI = view.getUint32(12, true);

        console.log('[WebSocket] Prev Close:', { securityId, prevClose, prevOI });

        // Store for calculating change percentage
        const instrument = this.subscribedInstruments.get(securityId.toString());
        if (instrument) {
            instrument.prevClose = prevClose;
            instrument.prevOI = prevOI;
        }
    }

    /**
     * Handle Full packet (Response Code: 8)
     * Includes quote data + market depth
     */
    handleFullPacket(packet) {
        // For now, treat as quote packet (can extend later for market depth)
        this.handleQuotePacket(packet);
    }

    /**
     * Subscribe to instruments
     * @param {Array} instruments - Array of {securityId, exchangeSegment}
     * @param {number} requestCode - 15=Ticker, 16=Quote, 17=Full
     */
    subscribe(instruments, requestCode = 15) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[WebSocket] Not connected, storing instruments for later');
            instruments.forEach(inst => {
                this.subscribedInstruments.set(inst.securityId, inst);
            });
            return;
        }

        // Store instruments
        instruments.forEach(inst => {
            this.subscribedInstruments.set(inst.securityId, inst);
        });

        // Split into batches of 100 instruments
        const batches = [];
        for (let i = 0; i < instruments.length; i += 100) {
            batches.push(instruments.slice(i, i + 100));
        }

        // Send subscription requests
        batches.forEach(batch => {
            const request = {
                RequestCode: requestCode,
                InstrumentCount: batch.length,
                InstrumentList: batch.map(inst => ({
                    ExchangeSegment: inst.exchangeSegment,
                    SecurityId: inst.securityId
                }))
            };

            console.log('[WebSocket] Subscribing to', batch.length, 'instruments');
            console.log('[WebSocket] Subscription request:', JSON.stringify(request, null, 2));
            this.ws.send(JSON.stringify(request));
        });

        this.updateStatus('Subscribed');
    }

    /**
     * Unsubscribe from instruments
     */
    unsubscribe(instruments) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const request = {
            RequestCode: 21, // Unsubscribe code
            InstrumentCount: instruments.length,
            InstrumentList: instruments.map(inst => ({
                ExchangeSegment: inst.exchangeSegment,
                SecurityId: inst.securityId
            }))
        };

        console.log('[WebSocket] Unsubscribing from', instruments.length, 'instruments');
        this.ws.send(JSON.stringify(request));

        // Remove from subscribed list
        instruments.forEach(inst => {
            this.subscribedInstruments.delete(inst.securityId);
        });
    }

    /**
     * Resubscribe to all instruments (after reconnection)
     */
    resubscribeAll() {
        const instruments = Array.from(this.subscribedInstruments.values());
        if (instruments.length > 0) {
            console.log('[WebSocket] Resubscribing to', instruments.length, 'instruments');
            this.subscribe(instruments);
        }
    }

    /**
     * Handle WebSocket errors
     */
    handleError(error) {
        console.error('[WebSocket] Error event:', error);
        console.error('[WebSocket] Error type:', error.type);
        console.error('[WebSocket] Error message:', error.message);
        this.updateStatus('Error');
    }

    /**
     * Handle WebSocket close event
     */
    handleClose(event) {
        console.log('[WebSocket] Connection closed');
        console.log('[WebSocket] Close code:', event.code);
        console.log('[WebSocket] Close reason:', event.reason);
        console.log('[WebSocket] Was clean:', event.wasClean);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.updateStatus('Disconnected');

        if (this.shouldReconnect) {
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached');
            this.updateStatus('Failed');
            return;
        }

        this.reconnectAttempts++;
        // Use shorter delays for faster reconnection during market hours
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 10000);
        
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.updateStatus(`Reconnecting... (${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Update connection status
     */
    updateStatus(status) {
        if (this.onConnectionStatus) {
            this.onConnectionStatus(status);
        }
    }

    /**
     * Start heartbeat monitoring
     */
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastMessage = now - this.lastMessageTime;
            
            if (timeSinceLastMessage > this.heartbeatTimeout) {
                console.warn('[WebSocket] No message received for', timeSinceLastMessage, 'ms - reconnecting');
                this.ws.close();
            }
        }, 10000); // Check every 10 seconds
    }

    /**
     * Stop heartbeat monitoring
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        this.shouldReconnect = false;
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.subscribedInstruments.clear();
        this.updateStatus('Disconnected');
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

// Export for use in watchlist page
window.DhanWebSocket = DhanWebSocket;

