const path = require('path');
// Load environment variables from server directory first, fallback to root
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error(`[Server] Database connection failed during startup: ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`[Server] Sentinel Core backend running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown handling for container orchestrators (Docker, Kubernetes, Render)
  const gracefulShutdown = (signal) => {
    console.log(`[Server] Received ${signal}. Closing HTTP server gracefully...`);
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();
