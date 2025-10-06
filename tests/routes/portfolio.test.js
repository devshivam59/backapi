const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Instrument = require('../../src/models/Instrument');
const Holding = require('../../src/models/Holding');
const Position = require('../../src/models/Position');
const Trade = require('../../src/models/Trade');
const { issueToken } = require('../../src/middleware/auth');
const marketDataService = require('../../src/services/marketDataService');

jest.mock('../../src/models/User');
jest.mock('../../src/models/Instrument');
jest.mock('../../src/models/Holding');
jest.mock('../../src/models/Position');
jest.mock('../../src/models/Trade');
jest.mock('../../src/services/marketDataService');

let user;
let token;
let instrument;

describe('Portfolio Routes', () => {
    beforeEach(() => {
        user = { _id: 'user123', id: 'user123', name: 'Test User', email: 'test@example.com', roles: ['client'], isBlocked: false };
        token = issueToken(user);
        instrument = { _id: 'instr123', id: 'instr123', name: 'RELIANCE', toObject: () => ({ id: 'instr123', name: 'RELIANCE' }) };

        User.findById.mockResolvedValue(user);
        marketDataService.ensureSnapshot.mockReturnValue({ ltp: 2500 });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should get user holdings with P&L', async () => {
        const mockHolding = {
            user: user._id,
            instrument: instrument,
            quantity: 10,
            averagePrice: 2400,
            toObject: () => ({
                user: user._id,
                instrument: instrument.toObject(),
                quantity: 10,
                averagePrice: 2400,
            })
        };
        Holding.find.mockReturnValue({
            populate: jest.fn().mockResolvedValue([mockHolding])
        });

        const res = await request(app)
            .get('/api/v1/portfolio/holdings')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].pnl_abs).toBe(1000); // (2500 - 2400) * 10
    });

    it('should get user positions with MTM', async () => {
        const mockPosition = {
            user_id: user._id,
            instrument_id: instrument,
            qty: -5,
            avg_price: 2550,
            toObject: () => ({
                user_id: user._id,
                instrument_id: instrument.toObject(),
                qty: -5,
                avg_price: 2550,
            })
        };
        Position.find.mockReturnValue({
            populate: jest.fn().mockResolvedValue([mockPosition])
        });

        const res = await request(app)
            .get('/api/v1/portfolio/positions')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].mtm).toBe(250); // (2500 * -5) - (2550 * -5)
    });

    it('should get user trades', async () => {
        const mockTrade = {
            user_id: user._id,
            instrument_id: instrument,
            toObject: () => ({
                user_id: user._id,
                instrument_id: instrument.toObject(),
            })
        };
        Trade.find.mockReturnValue({
            populate: jest.fn().mockResolvedValue([mockTrade])
        });

        const res = await request(app)
            .get('/api/v1/portfolio/trades')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(1);
    });
});