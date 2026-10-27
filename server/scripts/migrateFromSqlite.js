require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const User = require('../models/User');
const Policy = require('../models/Policy');
const Rule = require('../models/Rule');
const Log = require('../models/Log');
const Violation = require('../models/Violation');

const migrate = async () => {
  try {
    console.log('[Migration] Starting data migration from SQLite to MongoDB...');
    await connectDB();

    const dbPath = path.resolve(__dirname, '..', '..', 'svp', 'uday', 'db.sqlite3');
    const exporterScript = path.resolve(__dirname, 'exportSqliteData.py');

    if (!fs.existsSync(dbPath)) {
      throw new Error(`SQLite database file not found at: ${dbPath}`);
    }

    console.log(`[Migration] Extracting data from SQLite: ${dbPath}`);
    const rawOutput = execSync(`python "${exporterScript}" "${dbPath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });

    const data = JSON.parse(rawOutput);
    const { users = [], policies = [], rules = [], logs = [], violations = [] } = data;

    console.log(`[Migration] SQLite data loaded: ${users.length} users, ${policies.length} policies, ${rules.length} rules, ${logs.length} logs, ${violations.length} violations.`);

    // Copy media files
    const sourceMediaDir = path.resolve(__dirname, '..', '..', 'svp', 'uday', 'media', 'policies');
    const targetUploadsDir = path.resolve(__dirname, '..', 'uploads', 'policies');
    if (!fs.existsSync(targetUploadsDir)) {
      fs.mkdirSync(targetUploadsDir, { recursive: true });
    }

    if (fs.existsSync(sourceMediaDir)) {
      const files = fs.readdirSync(sourceMediaDir);
      for (const file of files) {
        const src = path.join(sourceMediaDir, file);
        const dst = path.join(targetUploadsDir, file);
        fs.copyFileSync(src, dst);
        console.log(`[Migration] Copied media file: ${file}`);
      }
    }

    // 1. Migrate Users
    console.log('[Migration] Migrating users...');
    const userMap = new Map(); // sqliteId -> MongoUser._id

    for (const u of users) {
      let existingUser = await User.findOne({ username: u.username });
      if (!existingUser) {
        existingUser = await User.create({
          sqliteId: u.id,
          username: u.username,
          password: u.password,
          role: u.role || 'employee',
          email: u.email || '',
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          date_joined: u.date_joined ? new Date(u.date_joined) : new Date(),
        });
        console.log(`[Migration] Created user: ${existingUser.username} (sqliteId: ${u.id})`);
      } else {
        existingUser.sqliteId = u.id;
        if (!existingUser.password && u.password) existingUser.password = u.password;
        await existingUser.save();
        console.log(`[Migration] Updated user: ${existingUser.username} (sqliteId: ${u.id})`);
      }
      userMap.set(u.id, existingUser._id);
    }

    // 2. Migrate Policies
    console.log('[Migration] Migrating policies...');
    const policyMap = new Map(); // sqliteId -> MongoPolicy._id

    for (const p of policies) {
      let existingPolicy = await Policy.findOne({
        $or: [{ sqliteId: p.id }, { title: p.title }],
      });

      const mongoUserId = userMap.get(p.uploaded_by_id) || null;
      const uploadedUser = mongoUserId ? await User.findById(mongoUserId) : null;

      if (!existingPolicy) {
        existingPolicy = await Policy.create({
          sqliteId: p.id,
          title: p.title,
          document: p.document || '',
          source_name: p.source_name || '',
          content_text: p.content_text || '',
          uploaded_by: mongoUserId,
          uploaded_by_username: uploadedUser ? uploadedUser.username : 'Unknown',
          created_at: p.created_at ? new Date(p.created_at) : new Date(),
        });
        console.log(`[Migration] Created policy: ${existingPolicy.title} (sqliteId: ${p.id})`);
      } else {
        existingPolicy.sqliteId = p.id;
        existingPolicy.document = p.document || existingPolicy.document;
        existingPolicy.source_name = p.source_name || existingPolicy.source_name;
        existingPolicy.content_text = p.content_text || existingPolicy.content_text;
        existingPolicy.uploaded_by = mongoUserId || existingPolicy.uploaded_by;
        existingPolicy.uploaded_by_username = uploadedUser ? uploadedUser.username : existingPolicy.uploaded_by_username;
        await existingPolicy.save();
        console.log(`[Migration] Updated policy: ${existingPolicy.title} (sqliteId: ${p.id})`);
      }
      policyMap.set(p.id, existingPolicy._id);
    }

    // 3. Migrate Rules
    console.log('[Migration] Migrating rules...');
    for (const r of rules) {
      const mongoPolicyId = policyMap.get(r.policy_id);
      if (!mongoPolicyId) {
        console.warn(`[Migration] Warning: Policy id ${r.policy_id} not found for rule ${r.id}`);
        continue;
      }

      let existingRule = await Rule.findOne({
        $or: [{ sqliteId: r.id }, { policy: mongoPolicyId, description: r.description }],
      });

      if (!existingRule) {
        existingRule = await Rule.create({
          sqliteId: r.id,
          policy: mongoPolicyId,
          description: r.description || '',
          condition: r.condition || '',
          action: r.action || '',
        });
        console.log(`[Migration] Created rule (sqliteId: ${r.id}) for policy ${mongoPolicyId}`);
      } else {
        existingRule.sqliteId = r.id;
        await existingRule.save();
      }
    }

    // 4. Migrate Logs
    console.log('[Migration] Migrating activity logs...');
    const logMap = new Map(); // sqliteId -> MongoLog._id

    for (const l of logs) {
      const mongoUserId = userMap.get(l.user_id) || null;
      const userDoc = mongoUserId ? await User.findById(mongoUserId) : null;

      let existingLog = await Log.findOne({
        $or: [{ sqliteId: l.id }, { action: l.action, user: mongoUserId }],
      });

      if (!existingLog) {
        existingLog = await Log.create({
          sqliteId: l.id,
          user: mongoUserId,
          username: userDoc ? userDoc.username : 'Unknown',
          action: l.action,
        });
        console.log(`[Migration] Created log: "${existingLog.action}" (sqliteId: ${l.id})`);
      } else {
        existingLog.sqliteId = l.id;
        await existingLog.save();
      }
      logMap.set(l.id, existingLog._id);
    }

    // 5. Migrate Violations
    console.log('[Migration] Migrating violations...');
    for (const v of violations) {
      const mongoLogId = logMap.get(v.log_id);
      if (!mongoLogId) {
        console.warn(`[Migration] Warning: Log id ${v.log_id} not found for violation ${v.id}`);
        continue;
      }

      let existingViolation = await Violation.findOne({
        $or: [{ sqliteId: v.id }, { log: mongoLogId, message: v.message }],
      });

      if (!existingViolation) {
        existingViolation = await Violation.create({
          sqliteId: v.id,
          log: mongoLogId,
          message: v.message,
        });
        console.log(`[Migration] Created violation (sqliteId: ${v.id}) for log ${mongoLogId}`);
      } else {
        existingViolation.sqliteId = v.id;
        await existingViolation.save();
      }
    }

    // Final verification count
    const [uCount, pCount, rCount, lCount, vCount] = await Promise.all([
      User.countDocuments(),
      Policy.countDocuments(),
      Rule.countDocuments(),
      Log.countDocuments(),
      Violation.countDocuments(),
    ]);

    console.log('\n=========================================');
    console.log(' MIGRATION COMPLETED SUCCESSFULLY');
    console.log('=========================================');
    console.log(`MongoDB Users:      ${uCount}`);
    console.log(`MongoDB Policies:   ${pCount}`);
    console.log(`MongoDB Rules:      ${rCount}`);
    console.log(`MongoDB Logs:       ${lCount}`);
    console.log(`MongoDB Violations: ${vCount}`);
    console.log('=========================================\n');

    process.exit(0);
  } catch (error) {
    console.error(`[Migration Error] ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
};

migrate();
