const { HttpError } = require('../utils/httpError');
const { getState, withState } = require('../store/dataStore');

function idempotency(scope) {
  return (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) {
      throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
    }

    const recordKey = `${scope}:${key}`;
    const { idempotency } = getState();
    const record = idempotency[recordKey];

    if (record) {
      res.status(record.status).json(record.body);
      return;
    }

    res.locals.idempotencyRecordKey = recordKey;
    res.locals.persistIdempotentResponse = (status, body) => {
      withState((state) => {
        state.idempotency[recordKey] = { status, body };
      });
    };

    next();
  };
}

module.exports = idempotency;
