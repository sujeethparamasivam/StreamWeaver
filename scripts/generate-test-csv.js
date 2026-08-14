#!/usr/bin/env node

/**
 * StreamWeaver Test Data Generator
 * 
 * Generates large CSV files for performance testing without loading entire
 * dataset into memory. Uses Node.js streams to write rows incrementally.
 * 
 * Usage:
 *   node scripts/generate-test-csv.js --rows 1000000 --output test-data-1m.csv
 * 
 * Supports:
 *   --rows       Number of rows (default: 100000)
 *   --output     Output file path (default: test-data-{rows}.csv)
 *   --seed       Random seed (for reproducible data)
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let rowCount = 100000;
let outputFile = null;
let seed = Math.random();

for (let i = 0; i < args.length; i += 2) {
  const arg = args[i];
  const value = args[i + 1];
  
  if (arg === '--rows') rowCount = parseInt(value, 10);
  if (arg === '--output') outputFile = value;
  if (arg === '--seed') seed = parseFloat(value);
}

// Default output filename
if (!outputFile) {
  outputFile = path.join(__dirname, '..', 'tmp', `test-data-${rowCount}.csv`);
}

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Seeded random number generator
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  next() {
    const x = Math.sin(this.seed) * 10000;
    this.seed = x - Math.floor(x);
    return this.seed;
  }
  
  nextInt(max) {
    return Math.floor(this.next() * max);
  }
  
  choice(arr) {
    return arr[this.nextInt(arr.length)];
  }
}

const random = new SeededRandom(seed);

// Sample data generators
const firstNames = ['John', 'Jane', 'Michael', 'Emma', 'David', 'Sarah', 'James', 'Mary', 'Robert', 'Patricia'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Support', 'Product'];
const statuses = ['Active', 'Inactive', 'On Leave', 'Contract'];

function generateRow(rowNumber) {
  const firstName = random.choice(firstNames);
  const lastName = random.choice(lastNames);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rowNumber}@example.com`;
  const department = random.choice(departments);
  const salary = 40000 + random.nextInt(120000);
  const status = random.choice(statuses);
  const joinDate = new Date(2015 + random.nextInt(9), random.nextInt(12), 1 + random.nextInt(28)).toISOString().split('T')[0];
  const rating = (2.5 + random.next() * 2.5).toFixed(1);
  
  return {
    employee_id: `EMP${String(rowNumber).padStart(8, '0')}`,
    first_name: firstName,
    last_name: lastName,
    email,
    department,
    salary: String(salary),
    status,
    join_date: joinDate,
    performance_rating: rating,
    manager_name: random.choice(firstNames) + ' ' + random.choice(lastNames),
    location: random.choice(['New York', 'San Francisco', 'Chicago', 'Boston', 'Austin', 'Seattle']),
    phone: `+1-${random.nextInt(999)}-${random.nextInt(999)}-${random.nextInt(9999)}`,
    created_at: new Date().toISOString()
  };
}

function csvEscape(value) {
  const strVal = String(value);
  if (strVal.includes('"') || strVal.includes(',') || strVal.includes('\n')) {
    return `"${strVal.replace(/"/g, '""')}"`;
  }
  return strVal;
}

function rowToCsv(row, headers) {
  return headers.map(h => csvEscape(row[h])).join(',');
}

async function generateTestFile() {
  const headers = [
    'employee_id', 'first_name', 'last_name', 'email', 'department', 
    'salary', 'status', 'join_date', 'performance_rating', 'manager_name',
    'location', 'phone', 'created_at'
  ];
  
  const startTime = Date.now();
  const writeStream = fs.createWriteStream(outputFile);
  
  // Write header
  writeStream.write(headers.join(',') + '\n');
  
  let rowsWritten = 0;
  let lastLogTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const writeNextBatch = () => {
      // Write 1000 rows at a time to avoid overwhelming memory
      const batchSize = 1000;
      let shouldContinue = true;
      
      for (let i = 0; i < batchSize && rowsWritten < rowCount; i++) {
        rowsWritten++;
        const row = generateRow(rowsWritten);
        const csvLine = rowToCsv(row, headers) + '\n';
        
        shouldContinue = writeStream.write(csvLine);
        
        // Log progress every 50,000 rows or every 5 seconds
        const now = Date.now();
        if (rowsWritten % 50000 === 0 || (now - lastLogTime > 5000)) {
          const elapsed = (now - startTime) / 1000;
          const rowsPerSec = Math.round(rowsWritten / elapsed);
          const progress = Math.round((rowsWritten / rowCount) * 100);
          console.log(`Generated ${rowsWritten.toLocaleString()} rows (${progress}%) - ${rowsPerSec} rows/sec`);
          lastLogTime = now;
        }
      }
      
      if (rowsWritten < rowCount) {
        if (shouldContinue) {
          // Continue immediately
          setImmediate(writeNextBatch);
        } else {
          // Wait for drain event if write buffer is full
          writeStream.once('drain', writeNextBatch);
        }
      } else {
        // All rows written, finish
        writeStream.end();
      }
    };
    
    writeStream.on('error', reject);
    writeStream.on('finish', () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const fileSize = fs.statSync(outputFile).size;
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
      console.log(`\n✅ Generated ${rowCount.toLocaleString()} rows in ${elapsed.toFixed(1)}s (${fileSizeMB} MB)`);
      console.log(`📁 Output: ${outputFile}`);
      resolve();
    });
    
    // Start writing
    writeNextBatch();
  });
}

// Run generator
console.log(`Generating ${rowCount.toLocaleString()} test rows to ${outputFile}...`);
generateTestFile()
  .then(() => {
    console.log('\n✨ Test data generation complete!');
    console.log('\nTo upload this file:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Open the app at http://localhost:5176');
    console.log('3. Go to Upload page and select the generated CSV');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error generating test data:', err);
    process.exit(1);
  });
