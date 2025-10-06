const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Ledger = require('../../src/models/Ledger');
const { issueToken } = require('../../src/middleware/auth');

jest.mock('../../src/models/User');
jest.mock('../../src/models/Ledger');

let user;
let admin;
let userToken;
let adminToken;

describe('Ledger Routes', () => {
    beforeEach(() => {
        user = {
            _id: 'user123',
            id: 'user123',
            name: 'Test User',
            email: 'test@example.com',
            roles: ['client'],
            isBlocked: false,
            fundsBalance: 1000,
            save: jest.fn().mockResolvedValue(true)
        };
        admin = { _id: 'admin123', id: 'admin123', name: 'Admin User', email: 'admin@example.com', roles: ['admin'], isBlocked: false };

        userToken = issueToken(user);
        adminToken = issueToken(admin);

        User.findById.mockImplementation(id => {
            if (id === 'user123') return Promise.resolve(user);
            if (id === 'admin123') return Promise.resolve(admin);
            return Promise.resolve(null);
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow an admin to make a ledger adjustment', async () => {
        Ledger.create.mockResolvedValue(true);

        const res = await request(app)
            .post('/api/v1/ledger/adjustment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                user_id: 'user123',
                type: 'CREDIT',
                amount: 500,
                note: 'Bonus funds'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.success).toBe(true);
        expect(user.save).toHaveBeenCalled();
        expect(Ledger.create).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'user123',
            type: 'CREDIT',
            credit: 500, // Corrected assertion from 'amount' to 'credit'
            note: 'Bonus funds'
        }));
    });

    it('should allow a user to get their ledger entries', async () => {
        const mockEntries = [{ toObject: () => ({ note: 'Test entry' }) }];
        Ledger.find.mockResolvedValue(mockEntries);

        const res = await request(app)
            .get('/api/v1/ledger')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(1);
        expect(Ledger.find).toHaveBeenCalledWith({ user_id: 'user123' });
    });

    it('should not allow a non-admin to make an adjustment', async () => {
        const res = await request(app)
            .post('/api/v1/ledger/adjustment')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                user_id: 'user123',
                type: 'CREDIT',
                amount: 500,
            });

        expect(res.statusCode).toEqual(403);
    });
});