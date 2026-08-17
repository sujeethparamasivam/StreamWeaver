import { BatchTransformStream, RowNumberingStream } from '../streams/batchTransformStream';
import { Readable } from 'node:stream';

/**
 * Test Suite for Batch Processing
 *
 * Tests:
 * 1. Exact batch sizes (5,000 records)
 * 2. Final partial batch handling
 * 3. Row number preservation
 * 4. No record loss
 */

// Test 1: Batch processing with exact multiples
export async function testExactBatching() {
  console.log('Test 1: Exact Batching (10,000 records)');

  // Generate 10,000 rows
  const rows = Array.from({ length: 10000 }, (_, i) => ({ id: i + 1, value: `row${i + 1}` }));
  const stream = Readable.from(rows, { objectMode: true });

  const numbered = stream.pipe(new RowNumberingStream());
  const batched = numbered.pipe(new BatchTransformStream(5000));

  const batches: any[] = [];

  return new Promise((resolve, reject) => {
    batched.on('data', (batch) => {
      batches.push(batch);
    });

    batched.on('end', () => {
      const passed =
        batches.length === 2 &&
        batches[0].length === 5000 &&
        batches[1].length === 5000 &&
        batches[0][0].rowNumber === 1 &&
        batches[0][4999].rowNumber === 5000 &&
        batches[1][0].rowNumber === 5001 &&
        batches[1][4999].rowNumber === 10000;

      console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
      resolve(passed);
    });

    batched.on('error', reject);
  });
}

// Test 2: Final partial batch handling
export async function testPartialBatch() {
  console.log('Test 2: Partial Batch (12,345 records)');

  // Generate 12,345 rows - 2 full batches + 1 partial
  const rows = Array.from({ length: 12345 }, (_, i) => ({ id: i + 1, value: `row${i + 1}` }));
  const stream = Readable.from(rows, { objectMode: true });

  const numbered = stream.pipe(new RowNumberingStream());
  const batched = numbered.pipe(new BatchTransformStream(5000));

  const batches: any[] = [];

  return new Promise((resolve, reject) => {
    batched.on('data', (batch) => {
      batches.push(batch);
    });

    batched.on('end', () => {
      const passed =
        batches.length === 3 &&
        batches[0].length === 5000 &&
        batches[1].length === 5000 &&
        batches[2].length === 2345 &&
        batches[2][0].rowNumber === 10001 &&
        batches[2][2344].rowNumber === 12345;

      console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
      resolve(passed);
    });

    batched.on('error', reject);
  });
}

// Test 3: Row numbering accuracy
export async function testRowNumbering() {
  console.log('Test 3: Row Numbering Accuracy');

  const rows = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const stream = Readable.from(rows, { objectMode: true });

  const numbered = stream.pipe(new RowNumberingStream());
  const batched = numbered.pipe(new BatchTransformStream(25));

  const batches: any[] = [];

  return new Promise((resolve, reject) => {
    batched.on('data', (batch) => {
      batches.push(batch);
    });

    batched.on('end', () => {
      // Verify all row numbers are unique and sequential
      const allRows = batches.flat();
      const rowNumbers = allRows.map((r: any) => r.rowNumber);
      const expected = Array.from({ length: 100 }, (_, i) => i + 1);

      const passed = JSON.stringify(rowNumbers) === JSON.stringify(expected);
      console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
      resolve(passed);
    });

    batched.on('error', reject);
  });
}

// Test 4: No record loss
export async function testNoRecordLoss() {
  console.log('Test 4: No Record Loss');

  const testCases = [
    { count: 5000, batchSize: 5000, expectedBatches: 1 },
    { count: 10001, batchSize: 5000, expectedBatches: 3 },
    { count: 1, batchSize: 5000, expectedBatches: 1 },
    { count: 4999, batchSize: 5000, expectedBatches: 1 },
    { count: 15000, batchSize: 5000, expectedBatches: 3 }
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    const rows = Array.from({ length: testCase.count }, (_, i) => ({ id: i + 1 }));
    const stream = Readable.from(rows, { objectMode: true });

    const numbered = stream.pipe(new RowNumberingStream());
    const batched = numbered.pipe(new BatchTransformStream(testCase.batchSize));

    let totalRecords = 0;
    let batchCount = 0;

    await new Promise<void>((resolve) => {
      batched.on('data', (batch: any[]) => {
        totalRecords += batch.length;
        batchCount += 1;
      });

      batched.on('end', () => {
        const passed = totalRecords === testCase.count && batchCount === testCase.expectedBatches;
        if (!passed) {
          console.log(`  ✗ Count=${testCase.count}: expected ${testCase.count} records in ${testCase.expectedBatches} batches, got ${totalRecords} records in ${batchCount} batches`);
          allPassed = false;
        }
        resolve();
      });
    });
  }

  console.log(allPassed ? '  ✓ PASS' : '  ✗ FAIL');
  return allPassed;
}

// Run all tests
export async function runAllTests() {
  console.log('\n=== Batch Processing Tests ===\n');

  const tests = [
    testExactBatching,
    testPartialBatch,
    testRowNumbering,
    testNoRecordLoss
  ];

  const results = [];
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
    } catch (err) {
      console.error(`  Error: ${err}`);
      results.push(false);
    }
  }

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\n=== Results: ${passed}/${total} passed ===\n`);

  return passed === total;
}

// Run if executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
