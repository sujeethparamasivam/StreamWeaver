import { runTransform } from '../services/sandboxService';

/**
 * Test Suite for Sandbox Execution
 *
 * Tests:
 * 1. Normal transformations
 * 2. Timeout handling
 * 3. Invalid JavaScript
 * 4. Security: process access prevention
 * 5. Security: require access prevention
 * 6. Memory limits
 */

// Test 1: Simple transformation
export async function testSimpleTransform() {
  console.log('Test 1: Simple Transform');

  const result = await runTransform('return value.toUpperCase();', 'hello', {});

  const passed = result.success && result.value === 'HELLO';
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 2: Numeric transformation
export async function testNumericTransform() {
  console.log('Test 2: Numeric Transform');

  const result = await runTransform('return Number(value) * 2;', '42', {});

  const passed = result.success && result.value === 84;
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 3: Access to row context
export async function testRowContext() {
  console.log('Test 3: Row Context Access');

  const result = await runTransform(
    'return row.firstName + " " + row.lastName;',
    'ignored',
    { firstName: 'John', lastName: 'Doe' }
  );

  const passed = result.success && result.value === 'John Doe';
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 4: Timeout handling
export async function testTimeout() {
  console.log('Test 4: Timeout Handling');

  const result = await runTransform(
    'while(true) {}',
    'value',
    {}
  );

  const passed = !result.success && result.error !== undefined;
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 5: Invalid JavaScript
export async function testInvalidJavaScript() {
  console.log('Test 5: Invalid JavaScript');

  const result = await runTransform(
    'return {this is not valid javascript',
    'value',
    {}
  );

  const passed = !result.success && result.error !== undefined;
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 6: Security - Process access prevention
export async function testNoProcessAccess() {
  console.log('Test 6: Security - No Process Access');

  const result = await runTransform(
    'return process.exit;',
    'value',
    {}
  );

  const passed = !result.success || result.value === undefined;
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 7: Security - Require prevention
export async function testNoRequireAccess() {
  console.log('Test 7: Security - No Require Access');

  const result = await runTransform(
    'return typeof require;',
    'value',
    {}
  );

  const passed = result.success && result.value === 'undefined';
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 8: Empty code handling
export async function testEmptyCode() {
  console.log('Test 8: Empty Code Handling');

  const result = await runTransform('', 'test_value', {});

  const passed = result.success && result.value === 'test_value';
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 9: Complex conditional transform
export async function testComplexTransform() {
  console.log('Test 9: Complex Transform');

  const code = `
    if (typeof value === 'string' && value.length > 0) {
      return value.trim().toLowerCase().replace(/\\s+/g, '_');
    }
    return '';
  `;

  const result = await runTransform(code, '  Hello  World  ', {});

  const passed = result.success && result.value === 'hello_world';
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Test 10: Date handling
export async function testDateHandling() {
  console.log('Test 10: Date Handling');

  const result = await runTransform(
    'return new Date("2024-01-15").getFullYear();',
    'ignored',
    {}
  );

  const passed = result.success && result.value === 2024;
  console.log(passed ? '  ✓ PASS' : '  ✗ FAIL');
  return passed;
}

// Run all tests
export async function runAllTests() {
  console.log('\n=== Sandbox Execution Tests ===\n');

  const tests = [
    testSimpleTransform,
    testNumericTransform,
    testRowContext,
    testTimeout,
    testInvalidJavaScript,
    testNoProcessAccess,
    testNoRequireAccess,
    testEmptyCode,
    testComplexTransform,
    testDateHandling
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
