let ivm: any = null;
let ivmLoadAttempted = false;
let ivmLoadError: Error | null = null;

const loadIsolatedVm = async () => {
  if (ivmLoadAttempted) return ivm;
  ivmLoadAttempted = true;

  try {
    // @ts-ignore
    ivm = await import('isolated-vm');
  } catch (err) {
    ivmLoadError = err instanceof Error ? err : new Error(String(err));
  }
  return ivm;
};

export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

const EXECUTION_TIMEOUT_MS = 50;
const MEMORY_LIMIT_MB = 32;

/**
 * Execute user code in a sandbox using isolated-vm.
 *
 * CRITICAL: isolated-vm is REQUIRED for secure user code execution.
 * If it is not available, transformations will fail with a clear error.
 * This ensures no unsafe code execution (no eval, Function, vm module, etc.).
 *
 * The sandbox:
 * - Has a 50ms timeout to prevent infinite loops
 * - Has access to `value` (the field being transformed)
 * - Has access to `row` (the full row object)
 * - Does NOT have access to process, require, fs, or other dangerous globals
 * - Is completely isolated from the host process
 * - Must return a value (implicit return via last expression)
 */
export async function runTransform(
  code: string,
  value: unknown,
  row: Record<string, unknown>
): Promise<SandboxResult> {
  if (!code || !code.trim()) {
    return { success: true, value };
  }

  // Ensure isolated-vm is available
  const isolatedVm = await loadIsolatedVm();
  if (!isolatedVm) {
    return {
      success: false,
      error: 'Secure JavaScript transformation is unavailable because isolated-vm could not be loaded. ' +
             'Please install isolated-vm package: npm install isolated-vm'
    };
  }

  try {
    const isolate = new isolatedVm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set('global', jail.derefInto());
    await jail.set('value', new isolatedVm.ExternalCopy(value).copyInto());
    await jail.set('row', new isolatedVm.ExternalCopy(row).copyInto());

    const script = await isolate.compileScript(`(function() {\n${code}\n})()`);
    const result = await script.run(context, { timeout: EXECUTION_TIMEOUT_MS });
    const output = result instanceof isolatedVm.Reference ? await result.copy() : result;
    return { success: true, value: output };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
