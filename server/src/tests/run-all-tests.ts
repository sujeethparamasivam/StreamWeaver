import { runAllTests as runJsonTests } from './streaming-json.test';
import { runAllTests as runBatchTests } from './batching.test';
import { runAllTests as runSandboxTests } from './sandbox.test';

async function runAllTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   StreamWeaver Test Suite              ║');
  console.log('╚════════════════════════════════════════╝\n');

  const results: { name: string; passed: boolean }[] = [];

  // Run JSON streaming tests
  const jsonPassed = await runJsonTests();
  results.push({ name: 'Streaming JSON Parser', passed: jsonPassed });

  // Run batch processing tests
  const batchPassed = await runBatchTests();
  results.push({ name: 'Batch Processing', passed: batchPassed });

  // Run sandbox tests
  const sandboxPassed = await runSandboxTests();
  results.push({ name: 'Sandbox Execution', passed: sandboxPassed });

  // Summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Test Summary                          ║');
  console.log('╚════════════════════════════════════════╝\n');

  let totalPassed = 0;
  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${result.name}`);
    if (result.passed) totalPassed += 1;
  }

  console.log(`\nTotal: ${totalPassed}/${results.length} test suites passed\n`);

  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
