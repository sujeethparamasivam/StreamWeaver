import express from 'express';
import mongoose from 'mongoose';
import UploadRow from '../models/UploadRow';
import MemorySample from '../models/MemorySample';
import ValidationRecord from '../models/ValidationRecord';
import ImportJob from '../models/ImportJob';

const app = express();

const cleanup = async () => {
  try {
    console.log('Connected to MongoDB');
    const db = mongoose.connection.db;
    
    if (!db) {
      console.error('Database connection is not available');
      return;
    }

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections`);

    for (const collection of collections) {
      const col = db.collection(collection.name);
      const count = await col.countDocuments();
      try {
        // Use collStats command to get collection statistics
        const stats = await db.command({ collStats: collection.name });
        const sizeInMB = ((stats as any).size / (1024 * 1024)).toFixed(2);
        console.log(`${collection.name}: ${count} docs, ${sizeInMB} MB`);
      } catch {
        console.log(`${collection.name}: ${count} docs, size unknown`);
      }
    }

    // Delete all large collections to free space
    console.log('\n\n=== DELETING OLD DATA ===\n');

    try {
      const uploadRowResult = await UploadRow.deleteMany({});
      console.log(`Deleted ${uploadRowResult.deletedCount} uploadrow documents`);
    } catch (e) {
      console.error('Error deleting uploadrows:', e);
    }

    try {
      const memorySampleResult = await MemorySample.deleteMany({});
      console.log(`Deleted ${memorySampleResult.deletedCount} memorysample documents`);
    } catch (e) {
      console.error('Error deleting memorysamples:', e);
    }

    try {
      const validationRecordResult = await ValidationRecord.deleteMany({});
      console.log(`Deleted ${validationRecordResult.deletedCount} validationrecord documents`);
    } catch (e) {
      console.error('Error deleting validationrecords:', e);
    }

    try {
      const importJobResult = await ImportJob.deleteMany({});
      console.log(`Deleted ${importJobResult.deletedCount} importjob documents`);
    } catch (e) {
      console.error('Error deleting importjobs:', e);
    }

    // Show updated space usage
    console.log('\n\n=== CLEANUP COMPLETE ===\n');
    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
};

export { cleanup };
