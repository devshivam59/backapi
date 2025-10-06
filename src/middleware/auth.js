const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError } = require('../utils/httpError');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRY = '1d';

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id, // user.id is a virtual from Mongoose model
      roles: user.roles || [],
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function authenticate(required = true) {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.substring(7) : null;

      if (!token) {
        if (required) {
          throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication token missing');
        }
        req.user = null;
        return next();
      }

      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.sub);

      if (!user) {
        if (required) {
          throw new HttpError(401, 'UNAUTHENTICATED', 'User no longer exists');
        }
        req.user = null;
        return next();
      }

      if (user.isBlocked) {
        throw new HttpError(403, 'ACCESS_DENIED', 'Account blocked');
      }
      req.user = user;
      next();
    } catch (error) {
      if (required) {
        if (error instanceof jwt.JsonWebTokenError || error.name === 'JsonWebTokenError') {
          throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
        }
        // Re-throw other errors to be caught by the asyncHandler and passed to the global error handler
        throw error;
      }
      req.user = null;
      next();
    }
  };
}

function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    const hasRole = (req.user.roles || []).some((role) => roles.includes(role));
    if (!hasRole) {
      throw new HttpError(403, 'ACCESS_DENIED', 'Insufficient role permissions');
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRoles,
  issueToken,
};