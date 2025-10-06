const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    scope: { type: String, required: true },
    status: { type: Number, required: true },
    body: { type: mongoose.Schema.Types.Mixed },
}, {
    timestamps: true,
});

idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 }); // Expire after 24 hours

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);