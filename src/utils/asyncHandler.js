const { toErrorResponse } = require('./httpError');

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      const { status, body } = toErrorResponse(error);
      res.status(status).json(body);
    }
  };
}

module.exports = asyncHandler;
