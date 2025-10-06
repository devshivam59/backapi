const { server, io, startServer, priceSimulator } = require('../src/server');
const ioClient = require('socket.io-client');
const Instrument = require('../src/models/Instrument');
const connectDatabase = require('../src/config/database');

// Mock dependencies
jest.mock('../src/config/database');
jest.mock('../src/models/Instrument');

let clientSocket;
const PORT = 3001; // Use a different port for this test suite to avoid conflicts

describe('WebSocket Price Streaming', () => {
    beforeAll(async () => {
        // Mock the implementation of connectDatabase to do nothing
        connectDatabase.mockImplementation(async () => {});
        // Start the server on a specific port
        await new Promise(resolve => server.listen(PORT, resolve));
    });

    afterAll((done) => {
        // Stop the simulator and close the server
        priceSimulator.stop();
        io.close(); // Close the socket.io server
        server.close(done); // Close the http server
    });

    beforeEach((done) => {
        clientSocket = ioClient(`http://localhost:${PORT}`);
        clientSocket.on('connect', done);
    });

    afterEach(() => {
        if (clientSocket && clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    it('should receive price updates for a subscribed instrument', async () => {
        const testSymbol = 'TESTSTOCK';
        const mockInstrument = {
            symbol: testSymbol,
            lastPrice: 100,
            save: jest.fn().mockResolvedValue(true),
        };
        Instrument.find.mockResolvedValue([mockInstrument]);

        // Wrap the event listener in a promise
        const priceUpdatePromise = new Promise(resolve => {
            clientSocket.on('price:update', (data) => {
                expect(data).toHaveProperty('symbol', testSymbol);
                expect(data).toHaveProperty('lastPrice');
                expect(typeof data.lastPrice).toBe('number');
                resolve();
            });
        });

        clientSocket.emit('subscribe', testSymbol);

        // Wait for the price update to be received
        await priceUpdatePromise;
    }, 30000); // Generous timeout for the test
});