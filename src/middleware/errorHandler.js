const { toErrorResponse } = require('../utils/httpError');

const notFound = (_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found'
    }
  });
};

const errorHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const { status, body } = toErrorResponse(err);
  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
