#!/usr/bin/env node
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

(async () => {
  let client;
  try {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const parsed = new URL(uri.replace(/^mongodb\+srv:\/\//, 'http://'));
    const dbName = (parsed.pathname || '').replace(/^\//, '') || 'admin';
    const db = client.db(dbName);

    const dbStats = await db.stats();
    console.log('Database:', db.databaseName);
    console.log('DB stats:', {
      collections: dbStats.collections,
      objects: dbStats.objects,
      dataSize: dbStats.dataSize,
      storageSize: dbStats.storageSize,
      indexSize: dbStats.indexSize
    });

    const cols = await db.listCollections().toArray();
    console.log('\nCollections:');
    for (const c of cols) {
      try {
        const s = await db.command({ collStats: c.name });
        console.log(`- ${c.name}: count=${s.count}, size=${s.size}, storageSize=${s.storageSize}, totalIndexSize=${s.totalIndexSize}`);
      } catch (e) {
        console.log(`- ${c.name}: error fetching stats: ${e}`);
      }
    }

    await client.close();
    process.exit(0);
  } catch (err) {
    if (client) try { await client.close(); } catch {};
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
})();
