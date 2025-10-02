const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./src/models/User');

const createAdminUser = async () => {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/trading_app');
    console.log('✅ Connected to MongoDB');
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@trading.com' });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      process.exit(0);
    }
    
    // Hash the password
    console.log('🔐 Hashing password...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@trading.com',
      password: hashedPassword,
      role: 'admin',
      isBlocked: false,
      fundsBalance: 1000000 // 10 lakh for testing
    });
    
    await adminUser.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@trading.com');
    console.log('🔑 Password: admin123');
    console.log('👑 Role: admin');
    console.log('💰 Funds Balance: ₹10,00,000');
    
    // Verify creation
    const userCount = await User.countDocuments();
    console.log(`📊 Total users in database: ${userCount}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
