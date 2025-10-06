const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    roles: { type: [String], enum: ['user', 'admin', 'client'], default: ['client'] },
    isBlocked: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    profile: {
        phone: String,
        address: String,
        pan: String
    }
  },
  {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret._id;
            delete ret.__v;
            delete ret.password;
        }
    },
    toObject: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret._id;
            delete ret.__v;
            delete ret.password;
        }
    }
  }
);

userSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

userSchema.pre('save', function (next) {
  if (this.isModified('password')) {
    this.password = bcrypt.hashSync(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compareSync(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);