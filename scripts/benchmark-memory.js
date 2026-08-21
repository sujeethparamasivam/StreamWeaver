#!/usr/bin/env node

/**
 * StreamWeaver Memory Audit and Performance Benchmark
 *
 * Tests:
 * 1. Memory usage during streaming
 * 2. Processing throughput (rows/sec)
 * 3. Peak RSS memory
 * 4. Compliance with 150MB memory limit
 *
 * Usage:
 *   node benchmark-memory.js --file large-dataset.csv --limit 150
 */

const fs = require('fs');
const path = require('path');
const { Transform, pipeline } = require('stream');
const { parse } = require('csv-parse');
const readline = require('readline');

// Mock models for testing
const mockUploadRow = {
  bulkWrite: async (ops) => {
    // Simulate bulkWrite operation
    return { ok: 1 };
  }
};

const mockMemorySample = {
  insertMany: async (docs) => {
    // Simulate insert
    return { insertedCount: docs.length };
  }
};

// Reusable stream classes (duplicate from server)
class ByteCounterStream extends Transform {
  constructor(onProgress, options = {}) {
    super(options);
    this.bytesRead = 0;
    this.onProgress = onProgress;
  }

  _transform(chunk, _encoding, callback) {
    this.bytesRead += chunk.length;
    this.onProgress?.(this.bytesRead);
    this.push(chunk);
    callback();
  }
}

class RowNumberingStream extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
    this.counter = 0;
  }

  _transform(record, _encoding, callback) {
    this.counter += 1;
    this.push({ rowNumber: this.counter, data: record });
    callback();
  }
}

class BatchTransformStream extends Transform {
  constructor(batchSize, options = {}) {
    super({ ...options, objectMode: true });
    this.batchSize = batchSize;
    this.batch = [];
  }

  _transform(record, _encoding, callback) {
    this.batch.push(record);
    if (this.batch.length >= this.batchSize) {
      this.push(this.batch);
      this.batch = [];
    }
    callback();
  }

  _flush(callback) {
    if (this.batch.length) {
      this.push(this.batch);
      this.batch = [];
    }
    callback();
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    file: null,
    limit: 150,
    batchSize: 5000,
    samplingInterval: 100
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') config.file = args[i + 1];
    if (args[i] === '--limit') config.limit = parseInt(args[i + 1], 10);
    if (args[i] === '--batch-size') config.batchSize = parseInt(args[i + 1], 10);
  }

  return config;
}

async function runBenchmark(config) {
  if (!config.file || !fs.existsSync(config.file)) {
    throw new Error(`File not found: ${config.file}`);
  }

  const stats = fs.statSync(config.file);
  const fileSize = stats.size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   StreamWeaver Memory Benchmark        ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log(`Configuration:`);
  console.log(`  File: ${config.file}`);
  console.log(`  Size: ${fileSizeMB} MB`);
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  Memory Limit: ${config.limit} MB\n`);

  const initialMemory = process.memoryUsage();
  const startTime = Date.now();
  const memorySamples = [];

  // Take memory samples during processing
  const samplingTimer = setInterval(() => {
    const mu = process.memoryUsage();
    memorySamples.push({
      ts: new Date(),
      rss: mu.rss,
      heapUsed: mu.heapUsed,
      heapTotal: mu.heapTotal,
      external: mu.external ?? 0
    });
  }, config.samplingInterval);

  let totalRows = 0;
  let totalBatches = 0;
  let bytesProcessed = 0;

  try {
    const readStream = fs.createReadStream(config.file);
    const byteCounter = new ByteCounterStream((bytesRead) => {
      bytesProcessed = bytesRead;
      process.stdout.write(`Progress: ${((bytesRead / fileSize) * 100).toFixed(1)}% (${(bytesRead / 1024 / 1024).toFixed(1)} MB)\r`);
    });

    const csvParser = parse({ columns: true, skip_empty_lines: true });
    const numbered = readStream
      .pipe(byteCounter)
      .pipe(csvParser)
      .pipe(new RowNumberingStream());

    const batched = numbered.pipe(new BatchTransformStream(config.batchSize));

    for await (const batch of batched) {
      totalRows += batch.length;
      totalBatches += 1;
      // Simulate bulkWrite
      await mockUploadRow.bulkWrite(batch.map(r => ({ insertOne: { document: r } })));
    }

    clearInterval(samplingTimer);

    const duration = Date.now() - startTime;
    const finalMemory = process.memoryUsage();

    // Calculate statistics
    const peakRss = Math.max(...memorySamples.map(s => s.rss));
    const peakHeap = Math.max(...memorySamples.map(s => s.heapUsed));
    const avgRss = Math.round(memorySamples.reduce((a, b) => a + b.rss, 0) / memorySamples.length);
    const avgHeap = Math.round(memorySamples.reduce((a, b) => a + b.heapUsed, 0) / memorySamples.length);

    const peakRssMB = Math.round(peakRss / 1024 / 1024);
    const peakHeapMB = Math.round(peakHeap / 1024 / 1024);
    const avgRssMB = Math.round(avgRss / 1024 / 1024);
    const avgHeapMB = Math.round(avgHeap / 1024 / 1024);

    const rowsPerSecond = Math.round(totalRows / (duration / 1000));
    const batchesPerSecond = Math.round(totalBatches / (duration / 1000));

    // Compliance check
    const compliant = peakRssMB <= config.limit;

    console.log(`\n\n╔════════════════════════════════════════╗`);
    console.log(`║   Benchmark Results                    ║`);
    console.log(`╚════════════════════════════════════════╝\n`);

    console.log(`File Processing:`);
    console.log(`  File Size: ${fileSizeMB} MB`);
    console.log(`  Rows Processed: ${totalRows.toLocaleString()}`);
    console.log(`  Batches: ${totalBatches.toLocaleString()}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s\n`);

    console.log(`Throughput:`);
    console.log(`  Rows/sec: ${rowsPerSecond.toLocaleString()}`);
    console.log(`  Batches/sec: ${batchesPerSecond.toLocaleString()}\n`);

    console.log(`Memory Usage:`);
    console.log(`  Peak RSS: ${peakRssMB} MB`);
    console.log(`  Peak Heap: ${peakHeapMB} MB`);
    console.log(`  Average RSS: ${avgRssMB} MB`);
    console.log(`  Average Heap: ${avgHeapMB} MB\n`);

    console.log(`Compliance:`);
    console.log(`  Memory Limit: ${config.limit} MB`);
    console.log(`  Peak RSS vs Limit: ${peakRssMB} MB ${peakRssMB <= config.limit ? '✓' : '✗'}`);
    console.log(`  Status: ${compliant ? '✓ PASS' : '✗ FAIL'}\n`);

    return {
      rows: totalRows,
      batches: totalBatches,
      duration,
      rowsPerSecond,
      batchesPerSecond,
      peakRssMB,
      peakHeapMB,
      avgRssMB,
      avgHeapMB,
      compliant,
      fileSizeMB: parseFloat(fileSizeMB),
      memoryLimit: config.limit
    };
  } finally {
    clearInterval(samplingTimer);
  }
}

async function main() {
  const config = parseArgs();

  if (!config.file) {
    console.error('\n✗ Error: --file parameter required\n');
    console.log('Usage:');
    console.log('  node benchmark-memory.js --file large-dataset.csv --limit 150\n');
    process.exit(1);
  }

  try {
    const result = await runBenchmark(config);

    // Write report to JSON
    const reportPath = path.join(path.dirname(config.file), 'benchmark-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`✓ Report saved: ${reportPath}\n`);

    process.exit(result.compliant ? 0 : 1);
  } catch (err) {
    console.error(`\n✗ Error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
