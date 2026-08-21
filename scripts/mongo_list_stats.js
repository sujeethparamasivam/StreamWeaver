#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not set in environment or .env');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(uri, { });
    const db = mongoose.connection.db;
    console.log('Connected to database:', db.databaseName);

    const dbStats = await db.stats();
    console.log('\nDatabase stats:');
    console.log(`  collections: ${dbStats.collections}`);
    console.log(`  objects:     ${dbStats.objects}`);
    console.log(`  dataSize:    ${dbStats.dataSize}`);
    console.log(`  storageSize: ${dbStats.storageSize}`);
    console.log(`  indexSize:   ${dbStats.indexSize}`);

    const cols = await db.listCollections().toArray();
    console.log('\nCollections:');
    for (const c of cols) {
      const name = c.name;
      const stats = await db.collection(name).stats();
      console.log(`\n- ${name}`);
      console.log(`    count: ${stats.count}`);
      console.log(`    size: ${stats.size}`);
      console.log(`    storageSize: ${stats.storageSize}`);
      console.log(`    totalIndexSize: ${stats.totalIndexSize}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error fetching stats:', err);
    process.exit(1);
  }
})();
