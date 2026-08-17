#!/usr/bin/env node

/**
 * Dataset Generator for StreamWeaver Benchmarking
 *
 * Generates large CSV/JSON test files without loading them entirely into memory.
 *
 * Usage:
 *   node generate-dataset.js --rows 1000000 --format csv --output large-dataset.csv
 *   node generate-dataset.js --rows 1000000 --format ndjson --output large-dataset.ndjson
 *   node generate-dataset.js --rows 1000000 --format json --output large-dataset.json
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    rows: 10000,
    format: 'csv',
    output: 'generated-dataset.csv',
    batchSize: 1000
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rows') config.rows = parseInt(args[i + 1], 10);
    if (args[i] === '--format') config.format = args[i + 1];
    if (args[i] === '--output') config.output = args[i + 1];
    if (args[i] === '--batch-size') config.batchSize = parseInt(args[i + 1], 10);
  }

  return config;
}

function generateRow(index) {
  return {
    id: index + 1,
    firstName: `First${Math.floor(Math.random() * 1000)}`,
    lastName: `Last${Math.floor(Math.random() * 1000)}`,
    email: `user${index}@example.com`,
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)],
    state: ['NY', 'CA', 'IL', 'TX', 'AZ'][Math.floor(Math.random() * 5)],
    zipCode: Math.floor(Math.random() * 100000).toString().padStart(5, '0'),
    country: 'USA',
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    salary: Math.floor(30000 + Math.random() * 150000),
    department: ['Sales', 'Engineering', 'Marketing', 'HR', 'Finance'][Math.floor(Math.random() * 5)],
    active: Math.random() > 0.1
  };
}

async function generateCSV(filePath, rowCount, batchSize) {
  const stream = fs.createWriteStream(filePath);

  // Write header
  const headers = Object.keys(generateRow(0));
  stream.write(headers.join(',') + '\n');

  for (let i = 0; i < rowCount; i++) {
    const row = generateRow(i);
    const values = headers.map(h => {
      const v = row[h];
      if (typeof v === 'string' && v.includes(',')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    });
    stream.write(values.join(',') + '\n');

    if ((i + 1) % batchSize === 0) {
      process.stdout.write(`Generated ${i + 1}/${rowCount} rows\r`);
    }
  }

  return new Promise((resolve, reject) => {
    stream.end(() => {
      const stats = fs.statSync(filePath);
      console.log(`\n✓ Generated CSV: ${filePath}`);
      console.log(`  Rows: ${rowCount}`);
      console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });
    stream.on('error', reject);
  });
}

async function generateNDJSON(filePath, rowCount, batchSize) {
  const stream = fs.createWriteStream(filePath);

  for (let i = 0; i < rowCount; i++) {
    const row = generateRow(i);
    stream.write(JSON.stringify(row) + '\n');

    if ((i + 1) % batchSize === 0) {
      process.stdout.write(`Generated ${i + 1}/${rowCount} rows\r`);
    }
  }

  return new Promise((resolve, reject) => {
    stream.end(() => {
      const stats = fs.statSync(filePath);
      console.log(`\n✓ Generated NDJSON: ${filePath}`);
      console.log(`  Rows: ${rowCount}`);
      console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });
    stream.on('error', reject);
  });
}

async function generateJSON(filePath, rowCount, batchSize) {
  const stream = fs.createWriteStream(filePath);
  stream.write('[\n');

  for (let i = 0; i < rowCount; i++) {
    const row = generateRow(i);
    stream.write(JSON.stringify(row));
    if (i < rowCount - 1) {
      stream.write(',\n');
    } else {
      stream.write('\n');
    }

    if ((i + 1) % batchSize === 0) {
      process.stdout.write(`Generated ${i + 1}/${rowCount} rows\r`);
    }
  }

  stream.write(']');

  return new Promise((resolve, reject) => {
    stream.end(() => {
      const stats = fs.statSync(filePath);
      console.log(`\n✓ Generated JSON Array: ${filePath}`);
      console.log(`  Rows: ${rowCount}`);
      console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });
    stream.on('error', reject);
  });
}

async function main() {
  const config = parseArgs();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   StreamWeaver Dataset Generator       ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log(`Configuration:`);
  console.log(`  Format: ${config.format.toUpperCase()}`);
  console.log(`  Rows: ${config.rows.toLocaleString()}`);
  console.log(`  Output: ${config.output}`);
  console.log(`  Batch Size: ${config.batchSize}\n`);

  const startTime = Date.now();

  try {
    if (config.format === 'csv') {
      await generateCSV(config.output, config.rows, config.batchSize);
    } else if (config.format === 'ndjson') {
      await generateNDJSON(config.output, config.rows, config.batchSize);
    } else if (config.format === 'json') {
      await generateJSON(config.output, config.rows, config.batchSize);
    } else {
      throw new Error(`Unsupported format: ${config.format}`);
    }

    const duration = Date.now() - startTime;
    console.log(`\nGeneration completed in ${(duration / 1000).toFixed(2)}s`);
  } catch (err) {
    console.error(`\n✗ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
