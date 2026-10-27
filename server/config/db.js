const mongoose = require('mongoose');

// Mongoose connection lifecycle monitoring
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Connection state: Connected');
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB] Runtime connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection state: Disconnected. Attempting automatic reconnection...');
});

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sentinel_compliance';
  try {
    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
    });
    console.log(`[MongoDB] Initialized successfully on ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Initial connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
