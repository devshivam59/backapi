const { HttpError } = require('../utils/httpError');
const IdempotencyKey = require('../models/IdempotencyKey');

function idempotency(scope) {
  return async (req, res, next) => {
    try {
        const key = req.headers['idempotency-key'];
        if (!key) {
          return next(new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required'));
        }

        const recordKey = `${scope}:${key}`;
        const record = await IdempotencyKey.findOne({ key: recordKey });

        if (record) {
          return res.status(record.status).json(record.body);
        }

        res.locals.idempotencyRecordKey = recordKey;
        res.locals.persistIdempotentResponse = async (status, body) => {
          await IdempotencyKey.create({
            key: recordKey,
            scope,
            status,
            body
          });
        };

        next();
    } catch(error) {
        next(error);
    }
  };
}

module.exports = idempotency;