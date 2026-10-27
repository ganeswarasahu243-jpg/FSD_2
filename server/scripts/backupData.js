const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const backupDir = path.resolve(__dirname, '..', '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function runBackup() {
  console.log('[Backup] Starting database backups...');

  // 1. Backup SQLite
  const sqliteSrc = path.resolve(__dirname, '..', '..', 'svp', 'uday', 'db.sqlite3');
  const sqliteDst = path.resolve(backupDir, 'db.sqlite3.bak');
  if (fs.existsSync(sqliteSrc)) {
    fs.copyFileSync(sqliteSrc, sqliteDst);
    console.log('[Backup] SQLite database backed up to:', sqliteDst);
  }

  // 2. Backup MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sentinel_compliance';
  await mongoose.connect(mongoUri);
  console.log('[Backup] Connected to MongoDB:', mongoUri);

  const collections = ['users', 'policies', 'rules', 'logs', 'violations'];
  const data = {};

  for (const name of collections) {
    try {
      const docs = await mongoose.connection.db.collection(name).find({}).toArray();
      data[name] = docs;
      console.log(`[Backup] Exported ${docs.length} records from collection: ${name}`);
    } catch (e) {
      console.warn(`[Backup] Warning reading ${name}:`, e.message);
      data[name] = [];
    }
  }

  const mongoDst = path.resolve(backupDir, 'mongo_backup_sentinel_compliance.json');
  fs.writeFileSync(mongoDst, JSON.stringify(data, null, 2));
  console.log('[Backup] MongoDB export saved to:', mongoDst);

  // 3. Backup Media/Uploads
  const mediaBackupDir = path.resolve(backupDir, 'media_policies');
  if (!fs.existsSync(mediaBackupDir)) {
    fs.mkdirSync(mediaBackupDir, { recursive: true });
  }

  const dirsToScan = [
    path.resolve(__dirname, '..', 'uploads', 'policies'),
    path.resolve(__dirname, '..', '..', 'svp', 'uday', 'media', 'policies'),
  ];

  let mediaCount = 0;
  for (const d of dirsToScan) {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d);
      for (const f of files) {
        const src = path.join(d, f);
        const dst = path.join(mediaBackupDir, f);
        if (fs.statSync(src).isFile() && !fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
          mediaCount++;
        }
      }
    }
  }
  console.log(`[Backup] Backed up ${mediaCount} policy media files to:`, mediaBackupDir);

  await mongoose.disconnect();
  console.log('[Backup] All data safely backed up!');
}

runBackup().catch((err) => {
  console.error('[Backup Error]', err);
  process.exit(1);
});
