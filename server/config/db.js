const mongoose = require('mongoose');

const sanitize = (msg) => {
  if (typeof msg !== 'string') return msg;
  return msg.replace(/\/\/([^:]+):([^@]+)@/g, '//$1:****@');
};

// Mongoose connection lifecycle monitoring
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Connection state: Connected');
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB] Runtime connection error: ${sanitize(err.message)}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection state: Disconnected. Attempting automatic reconnection...');
});

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sentinel_compliance';
  
  if (connUri.includes('<URL_ENCODED_PASSWORD>') || connUri.includes('<db_password>') || connUri.includes('<password>')) {
    const errorMsg = 'Database URI contains password placeholder (<URL_ENCODED_PASSWORD>). Please update server/.env with your real MongoDB Atlas password.';
    console.error(`[MongoDB Configuration Blocked] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
    });
    console.log(`[MongoDB] Initialized successfully on ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Initial connection error: ${sanitize(error.message)}`);
    throw error;
  }
};

module.exports = connectDB;
