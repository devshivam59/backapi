const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Instrument = require('../../src/models/Instrument');
const Order = require('../../src/models/Order');
const Trade = require('../../src/models/Trade');
const IdempotencyKey = require('../../src/models/IdempotencyKey');
const { issueToken } = require('../../src/middleware/auth');
const { randomUUID } = require('crypto');
const orderEngine = require('../../src/services/orderEngine');

jest.mock('../../src/models/User');
jest.mock('../../src/models/Instrument');
jest.mock('../../src/models/Order');
jest.mock('../../src/models/Trade');
jest.mock('../../src/models/IdempotencyKey');
jest.mock('../../src/services/orderEngine');

let user;
let token;
let instrument;

describe('Order Routes', () => {
    beforeEach(() => {
        user = { _id: 'user123', id: 'user123', name: 'Test User', email: 'test@example.com', roles: ['client'], isBlocked: false };
        token = issueToken(user);
        instrument = { _id: 'instr123', id: 'instr123', name: 'RELIANCE' };

        User.findById.mockResolvedValue(user);
        Instrument.findById.mockResolvedValue(instrument);
        IdempotencyKey.findOne.mockResolvedValue(null);
        IdempotencyKey.create.mockResolvedValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should place a new market order', async () => {
        const mockOrder = { id: 'order123', status: 'COMPLETE', filled_qty: 10, toObject: () => ({ id: 'order123', status: 'COMPLETE', filled_qty: 10 })};
        const mockTrade = { id: 'trade123', toObject: () => ({ id: 'trade123' })};
        orderEngine.placeOrder.mockResolvedValue({ order: mockOrder, trade: mockTrade });

        const idempotencyKey = randomUUID();
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', idempotencyKey)
            .send({
                instrument_id: instrument.id,
                side: 'BUY',
                qty: 10,
                order_type: 'MARKET',
                product: 'CNC'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.order.status).toBe('COMPLETE');
        expect(orderEngine.placeOrder).toHaveBeenCalled();
    });

    it('should handle idempotent order placement', async () => {
        const idempotencyKey = randomUUID();
        const mockResponse = { data: { order: { id: 'order123' } } };
        IdempotencyKey.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 201, body: mockResponse });

        const res1 = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', idempotencyKey)
            .send({ instrument_id: instrument.id, side: 'BUY', qty: 10 });

        expect(res1.statusCode).toEqual(201);

        const res2 = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', idempotencyKey)
            .send({ instrument_id: instrument.id, side: 'BUY', qty: 10 });

        expect(res2.statusCode).toEqual(201);
        expect(res2.body.data.order.id).toBe('order123');
        expect(orderEngine.placeOrder).toHaveBeenCalledTimes(1);
    });

    it('should get a list of orders for a user', async () => {
        const mockOrders = [{ toObject: () => ({ id: 'order123' }) }];
        Order.find.mockResolvedValue(mockOrders);

        const res = await request(app)
            .get('/api/v1/orders')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.length).toBe(1);
    });

    it('should cancel an open order', async () => {
        const mockOrder = {
            id: 'order123',
            status: 'OPEN',
            save: jest.fn().mockResolvedValue(true),
            toObject: () => ({ id: 'order123', status: 'CANCELLED' })
        };
        Order.findOne.mockResolvedValue(mockOrder);

        const res = await request(app)
            .post(`/api/v1/orders/${mockOrder.id}/cancel`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toBe('CANCELLED');
        expect(mockOrder.save).toHaveBeenCalled();
    });
});