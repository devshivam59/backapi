const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');

// Mock the User model
jest.mock('../../src/models/User');

describe('Auth Routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should register a new user', async () => {
        User.findOne.mockResolvedValue(null); // No existing user
        const mockUser = {
            id: 'user123',
            name: 'Test User',
            email: 'test@example.com',
            roles: ['client'],
            toObject: () => ({ id: 'user123', name: 'Test User', email: 'test@example.com', roles: ['client'] }),
            save: jest.fn().mockResolvedValue(true),
        };
        User.prototype.save = mockUser.save;
        User.mockImplementation(() => mockUser);

        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data).toHaveProperty('token');
        expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(mockUser.save).toHaveBeenCalled();
    });

    it('should not login a non-existent user', async () => {
        User.findOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(null)
        });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });

        expect(res.statusCode).toEqual(401);
        expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should login an existing user with correct password', async () => {
        const mockUser = {
            id: 'user123',
            _id: 'user123',
            name: 'Test User',
            email: 'test@example.com',
            roles: ['client'],
            isBlocked: false,
            comparePassword: jest.fn().mockResolvedValue(true),
            toObject: () => ({ id: 'user123', name: 'Test User', email: 'test@example.com', roles: ['client'] }),
        };
        User.findOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(mockUser),
        });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveProperty('token');
        expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
    });
});