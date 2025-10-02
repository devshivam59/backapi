const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { HttpError } = require('../utils/httpError');
const { getState } = require('../store/dataStore');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRY = '1d';

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      roles: user.roles || [],
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function authenticate(required = true) {
  return (req, _res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;

    if (!token) {
      if (required) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication token missing');
      }
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const { users } = getState();
      const user = users.find((item) => item.id === payload.sub);
      if (!user) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'User no longer exists');
      }
      if (user.isBlocked) {
        throw new HttpError(403, 'ACCESS_DENIED', 'Account blocked');
      }
      req.user = user;
      next();
    } catch (error) {
      if (required) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
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
  hashPassword,
  verifyPassword
};
