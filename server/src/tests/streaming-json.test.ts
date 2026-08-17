import { NDJSONParserStream, readAndParseJsonSafely, detectJsonFormat } from '../utils/streamingJsonParser';
import { Readable } from 'node:stream';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Test Suite for Streaming JSON Parser
 *
 * Tests:
 * 1. NDJSON parsing with multiple lines
 * 2. Empty line skipping
 * 3. Error handling for invalid JSON
 * 4. Size limit enforcement
 * 5. Format detection
 */

const tmpDir = path.join(os.tmpdir(), 'streamweaver-tests');

async function ensureTmpDir() {
  try {
    await fs.mkdir(tmpDir, { recursive: true });
  } catch {
    // already exists
  }
}

async function cleanupFile(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

// Test 1: Parse NDJSON with multiple valid objects
export async function testNdjsonParsing() {
  console.log('Test 1: NDJSON Parsing');
  const ndjson = `{"id": 1, "name": "Alice"}
{"id": 2, "name": "Bob"}
{"id": 3, "name": "Charlie"}`;

  const stream = Readable.from([ndjson]);
  const parser = stream.pipe(new NDJSONParserStream());

  const results: any[] = [];
  return new Promise((resolve, reject) => {
    parser.on('data', (obj) => {
      results.push(obj);
    });

    parser.on('end', () => {
      const passed = results.length === 3 &&
        results[0].id === 1 &&
        results[1].id === 2 &&
        results[2].id === 3;
      console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
      resolve(passed);
    });

    parser.on('error', reject);
  });
}

// Test 2: Skip empty lines and comments
export async function testEmptyLineSkipping() {
  console.log('Test 2: Empty Line Skipping');
  const ndjson = `{"id": 1}

{"id": 2}
// This is a comment
{"id": 3}

`;

  const stream = Readable.from([ndjson]);
  const parser = stream.pipe(new NDJSONParserStream());

  const results: any[] = [];
  return new Promise((resolve, reject) => {
    parser.on('data', (obj) => {
      results.push(obj);
    });

    parser.on('end', () => {
      const passed = results.length === 3;
      console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
      resolve(passed);
    });

    parser.on('error', reject);
  });
}

// Test 3: Handle invalid JSON gracefully
export async function testInvalidJsonHandling() {
  console.log('Test 3: Invalid JSON Handling');
  const ndjson = `{"id": 1}
{invalid json}
{"id": 3}`;

  const stream = Readable.from([ndjson]);
  const parser = stream.pipe(new NDJSONParserStream());

  const results: any[] = [];
  const errors: any[] = [];

  return new Promise((resolve, reject) => {
    parser.on('data', (obj) => {
      results.push(obj);
    });

    parser.on('data-error', (err) => {
      errors.push(err);
    });

    parser.on('end', () => {
      const passed = results.length === 2 && errors.length === 1;
      console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
      resolve(passed);
    });

    parser.on('error', reject);
  });
}

// Test 4: JSON Array parsing
export async function testJsonArrayParsing() {
  console.log('Test 4: JSON Array Parsing');
  const jsonArray = '[{"id": 1}, {"id": 2}, {"id": 3}]';

  const stream = Readable.from([Buffer.from(jsonArray)]);
  const parsed = await readAndParseJsonSafely(stream);

  const passed = Array.isArray(parsed) && parsed.length === 3;
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 5: Size limit enforcement
export async function testSizeLimit() {
  console.log('Test 5: Size Limit Enforcement');
  const largJson = JSON.stringify({ data: 'x'.repeat(200 * 1024 * 1024) }); // 200+ MB
  const stream = Readable.from([largJson]);

  try {
    await readAndParseJsonSafely(stream, 50 * 1024 * 1024); // 50 MB limit
    console.log('  ✗ FAIL - should have thrown error');
    return false;
  } catch (err) {
    const passed = (err instanceof Error) && err.message.includes('exceeds maximum');
    console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
    return passed;
  }
}

// Test 6: Format detection for JSON array
export async function testFormatDetectionArray() {
  console.log('Test 6: Format Detection (Array)');
  await ensureTmpDir();

  const filePath = path.join(tmpDir, 'test-array.json');
  await fs.writeFile(filePath, '[{"id": 1}, {"id": 2}]');

  try {
    const format = await detectJsonFormat(filePath);
    const passed = format === '[';
    console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
    return passed;
  } finally {
    await cleanupFile(filePath);
  }
}

// Test 7: Format detection for JSON object
export async function testFormatDetectionObject() {
  console.log('Test 7: Format Detection (Object)');
  await ensureTmpDir();

  const filePath = path.join(tmpDir, 'test-object.json');
  await fs.writeFile(filePath, '{"id": 1}');

  try {
    const format = await detectJsonFormat(filePath);
    const passed = format === '{';
    console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
    return passed;
  } finally {
    await cleanupFile(filePath);
  }
}

// Run all tests
export async function runAllTests() {
  console.log('\n=== Streaming JSON Parser Tests ===\n');

  const tests = [
    testNdjsonParsing,
    testEmptyLineSkipping,
    testInvalidJsonHandling,
    testJsonArrayParsing,
    testSizeLimit,
    testFormatDetectionArray,
    testFormatDetectionObject
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
