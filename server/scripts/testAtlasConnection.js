require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function testAtlas() {
  const uri = process.env.MONGODB_URI;

  console.log('====================================================');
  console.log('       MONGODB ATLAS CLUSTER0 CONNECTION TEST       ');
  console.log('====================================================');

  if (!uri) {
    console.error('[ERROR] MONGODB_URI is not defined in server/.env');
    process.exit(1);
  }

  // Check if placeholder is still present
  if (uri.includes('<db_password>') || uri.includes('<password>') || uri.includes('<URL_ENCODED_PASSWORD>')) {
    console.error('[BLOCKED] MONGODB_URI contains password placeholder "<URL_ENCODED_PASSWORD>".');
    console.error('Please edit server/.env and replace <URL_ENCODED_PASSWORD> with your Atlas user password.');
    process.exit(2);
  }

  // Mask credentials for display
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log(`[Config] Connecting to: ${maskedUri}`);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });

    console.log('[SUCCESS] Successfully connected to MongoDB Atlas!');
    console.log(`[Atlas] Host: ${conn.connection.host}`);
    console.log(`[Atlas] Database Name: ${conn.connection.name}`);
    console.log(`[Atlas] Connection State: ${conn.connection.readyState === 1 ? 'Ready (Connected)' : 'Connecting'}`);

    // Verify Models and Collection Counts
    const User = require('../models/User');
    const Policy = require('../models/Policy');
    const Rule = require('../models/Rule');
    const Log = require('../models/Log');
    const Violation = require('../models/Violation');

    const counts = {
      users: await User.countDocuments(),
      policies: await Policy.countDocuments(),
      rules: await Rule.countDocuments(),
      logs: await Log.countDocuments(),
      violations: await Violation.countDocuments(),
    };

    console.log('[Data] Current collection counts on Atlas:');
    console.log(`  - Users: ${counts.users}`);
    console.log(`  - Policies: ${counts.policies}`);
    console.log(`  - Rules: ${counts.rules}`);
    console.log(`  - Logs: ${counts.logs}`);
    console.log(`  - Violations: ${counts.violations}`);

    // Non-destructive Canary Write/Read/Delete Test
    console.log('[CRUD] Testing create, read, and delete permissions on Atlas...');
    const testDoc = await Log.create({
      employee: 'atlas_healthcheck',
      action: 'Atlas connection verification ping',
      flagged: false,
    });
    console.log(`[CRUD] Created canary document: ${testDoc._id}`);

    const fetchedDoc = await Log.findById(testDoc._id);
    if (!fetchedDoc) throw new Error('Failed to retrieve canary document from Atlas.');
    console.log('[CRUD] Successfully read canary document.');

    await Log.findByIdAndDelete(testDoc._id);
    console.log('[CRUD] Cleaned up canary document. CRUD verification passed!');

    await mongoose.disconnect();
    console.log('====================================================');
    console.log('   ALL ATLAS CHECKS PASSED SUCCESSFULLY (0 ERRORS)  ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('[Atlas Error]:', err.message);
    if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
      console.error('-> Cause: Authentication failed. Please verify your Atlas username and password.');
    } else if (err.message.includes('querySrv ENOTFOUND') || err.message.includes('ENOTFOUND')) {
      console.error('-> Cause: DNS resolution failed. Check your cluster hostname.');
    } else if (err.message.includes('Server selection timed out')) {
      console.error('-> Cause: Timeout connecting to cluster. Check IP Access List (Whitelist) in MongoDB Atlas.');
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

testAtlas();
