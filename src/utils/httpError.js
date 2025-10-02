class HttpError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details || undefined
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: error && error.message ? error.message : 'Unexpected error',
        details: undefined
      }
    }
  };
}

module.exports = {
  HttpError,
  toErrorResponse
};
