const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Instrument = require('../../src/models/Instrument');
const { issueToken } = require('../../src/middleware/auth');

jest.mock('../../src/models/User');
jest.mock('../../src/models/Instrument');

let token;
let adminToken;

describe('Instrument Routes', () => {
  beforeEach(() => {
    const mockUser = { _id: 'user123', id: 'user123', name: 'Test User', email: 'test@example.com', roles: ['client'], isBlocked: false };
    const mockAdmin = { _id: 'admin123', id: 'admin123', name: 'Admin User', email: 'admin@example.com', roles: ['admin'], isBlocked: false };

    User.findById.mockImplementation(id => {
        if (id === 'user123') return Promise.resolve(mockUser);
        if (id === 'admin123') return Promise.resolve(mockAdmin);
        return Promise.resolve(null);
    });

    token = issueToken(mockUser);
    adminToken = issueToken(mockAdmin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should search for instruments', async () => {
    const mockInstruments = [{ name: 'NIFTY 50', toObject: () => ({ name: 'NIFTY 50' }) }];
    // Make the mock chainable
    Instrument.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockInstruments)
    });
    Instrument.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/instruments?q=NIFTY')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('NIFTY 50');
    expect(Instrument.find).toHaveBeenCalledWith({ '$text': { '$search': 'NIFTY' } });
  });

  it('should import instruments from CSV', async () => {
    Instrument.bulkWrite.mockResolvedValue({ ok: 1 });

    const csvData = `tradingsymbol,name,exchange,instrument_type\nINFY,Infosys,NSE,stock\nTCS,Tata Consultancy Services,NSE,stock`;

    const res = await request(app)
      .post('/api/v1/instruments/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csvData), 'instruments.csv');

    expect(res.statusCode).toEqual(202);
    expect(res.body.data.rows_ok).toBe(2);
    expect(Instrument.bulkWrite).toHaveBeenCalledWith(
        expect.arrayContaining([
            expect.objectContaining({
                updateOne: expect.objectContaining({
                    filter: { tradingsymbol: 'INFY', exchange: 'NSE' },
                })
            })
        ])
    );
  });
});