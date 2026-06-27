const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    const conn = await mongoose.connect('mongodb://localhost:27017/rms', {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB CONNECTED!');
    console.log('Host:', conn.connection.host);
    console.log('Database:', conn.connection.name);
    
    // Count users
    const userCount = await conn.connection.collection('users').countDocuments();
    console.log('Users in database:', userCount);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ MongoDB CONNECTION FAILED');
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testConnection();
