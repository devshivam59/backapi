const express = require('express');
const User = require('../../models/User');
const { authenticate, issueToken, requireRoles } = require('../../middleware/auth');
const { HttpError } = require('../../utils/httpError');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// This sanitize function now works with a Mongoose document
function sanitizeUser(user) {
    if (!user) return null;
    return user.toObject(); // Use Mongoose's toObject to apply transformations
}

router.post('/register', asyncHandler(async (req, res) => {
    const { name, email, password, roles } = req.body;
    if (!name || !email || !password) {
        throw new HttpError(400, 'VALIDATION_FAILED', 'Name, email, and password are required');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw new HttpError(409, 'EMAIL_EXISTS', 'Email already registered');
    }

    const user = new User({
        name,
        email,
        password, // Password will be hashed by the pre-save hook in the User model
        roles: Array.isArray(roles) && roles.length ? roles : ['client'],
    });
    await user.save();

    const token = issueToken(user);
    res.status(201).json({
        data: {
            token,
            user: sanitizeUser(user)
        }
    });
}));

router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new HttpError(400, 'VALIDATION_FAILED', 'Email and password are required');
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.isBlocked) {
        throw new HttpError(403, 'ACCESS_DENIED', 'Account blocked');
    }

    const token = issueToken(user);
    res.json({
        data: {
            token,
            user: sanitizeUser(user)
        }
    });
}));

router.get('/me', authenticate(true), asyncHandler(async (req, res) => {
    res.json({ data: sanitizeUser(req.user) });
}));

router.put('/me', authenticate(true), asyncHandler(async (req, res) => {
    const { name, profile } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
        throw new HttpError(404, 'NOT_FOUND', 'User not found');
    }

    if (name) user.name = name;
    if (profile) {
        user.profile.phone = profile.phone ?? user.profile.phone;
        user.profile.address = profile.address ?? user.profile.address;
        user.profile.pan = profile.pan ?? user.profile.pan;
    }

    await user.save();

    res.json({ data: sanitizeUser(user) });
}));

router.post('/password/change', authenticate(true), asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        throw new HttpError(400, 'VALIDATION_FAILED', 'Current and new passwords are required');
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
        throw new HttpError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    res.json({ data: { success: true } });
}));

module.exports = router;