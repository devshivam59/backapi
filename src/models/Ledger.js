const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ref: { type: String },
    type: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    note: { type: String },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret._id;
            delete ret.__v;
        }
    },
    toObject: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret._id;
            delete ret.__v;
        }
    }
});

ledgerSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

module.exports = mongoose.model('Ledger', ledgerSchema);