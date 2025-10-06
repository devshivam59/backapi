const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Instrument = require('../../src/models/Instrument');
const Watchlist = require('../../src/models/Watchlist');
const WatchlistItem = require('../../src/models/WatchlistItem');
const { issueToken } = require('../../src/middleware/auth');

jest.mock('../../src/models/User');
jest.mock('../../src/models/Instrument');
jest.mock('../../src/models/Watchlist');
jest.mock('../../src/models/WatchlistItem');

let user;
let token;
let instrument;

describe('Watchlist Routes', () => {
    beforeEach(() => {
        user = { _id: 'user123', id: 'user123', name: 'Test User', email: 'test@example.com', roles: ['client'], isBlocked: false };
        token = issueToken(user);
        instrument = { _id: 'instr123', id: 'instr123', name: 'RELIANCE', toObject: () => ({ id: 'instr123', name: 'RELIANCE' }) };

        User.findById.mockResolvedValue(user);
        Instrument.findById.mockResolvedValue(instrument);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create a new watchlist', async () => {
        const mockWatchlist = {
            _id: 'wl123',
            name: 'My Watchlist',
            toObject: () => ({ id: 'wl123', name: 'My Watchlist' }),
            save: jest.fn().mockResolvedValue(true)
        };
        Watchlist.mockImplementation(() => mockWatchlist);
        WatchlistItem.find.mockReturnValue({ // Ensure find is chainable
            sort: jest.fn().mockReturnThis(),
            populate: jest.fn().mockResolvedValue([])
        });

        const res = await request(app)
            .post('/api/v1/watchlists')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'My Watchlist' });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.name).toBe('My Watchlist');
        expect(mockWatchlist.save).toHaveBeenCalled();
    });

    it('should get all watchlists for a user', async () => {
        const mockWatchlist = { _id: 'wl123', name: 'My Watchlist', toObject: () => ({ id: 'wl123', name: 'My Watchlist' }) };
        const mockItem = {
            _id: 'item123',
            instrument_id: instrument,
            toObject: () => ({ id: 'item123', instrument: instrument.toObject() })
        };

        Watchlist.find.mockResolvedValue([mockWatchlist]);
        WatchlistItem.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            populate: jest.fn().mockResolvedValue([mockItem]),
        });

        const res = await request(app)
            .get('/api/v1/watchlists')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe('My Watchlist');
        expect(res.body.data[0].items.length).toBe(1);
    });

    it('should add an item to a watchlist', async () => {
        const mockWatchlist = { _id: 'wl123' };
        const mockItem = {
            save: jest.fn().mockResolvedValue(true),
            toObject: () => ({ instrument_id: 'instr123' })
        };
        Watchlist.findOne.mockResolvedValue(mockWatchlist);
        WatchlistItem.countDocuments.mockResolvedValue(0);
        WatchlistItem.mockImplementation(() => mockItem);

        const res = await request(app)
            .post(`/api/v1/watchlists/${mockWatchlist._id}/items`)
            .set('Authorization', `Bearer ${token}`)
            .send({ instrument_id: instrument.id });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.instrument_id).toBe(instrument.id);
        expect(mockItem.save).toHaveBeenCalled();
    });

    it('should delete a watchlist', async () => {
        const mockWatchlist = { _id: 'wl123' };
        Watchlist.findOne.mockResolvedValue(mockWatchlist);
        Watchlist.deleteOne.mockResolvedValue({ deletedCount: 1 });
        WatchlistItem.deleteMany.mockResolvedValue({ deletedCount: 1 });

        const res = await request(app)
            .delete(`/api/v1/watchlists/${mockWatchlist._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(204);
        expect(Watchlist.deleteOne).toHaveBeenCalledWith({ _id: mockWatchlist._id });
        expect(WatchlistItem.deleteMany).toHaveBeenCalledWith({ watchlist_id: mockWatchlist._id });
    });
});