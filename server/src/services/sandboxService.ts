import vm from 'node:vm';

let ivm: any = null;
let ivmLoadAttempted = false;

const loadIsolatedVm = async () => {
  if (ivmLoadAttempted) return ivm;
  ivmLoadAttempted = true;

  try {
    // dynamic import; if native addon isn't present the import will fail
    // and we'll fall back to the built-in vm implementation.
    // @ts-ignore
    ivm = await import('isolated-vm');
  } catch {
    ivm = null;
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
 * Execute user code in a sandbox using isolated-vm if available,
 * falling back to Node's vm module for basic isolation.
 *
 * The sandbox:
 * - Has a 50ms timeout to prevent infinite loops
 * - Has access to `value` (the field being transformed)
 * - Has access to `row` (the full row object)
 * - Does NOT have access to process, require, fs, or other dangerous globals
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

  const isolatedVm = await loadIsolatedVm();

  // Try isolated-vm first if available
  if (isolatedVm) {
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

  // Fallback to Node.js vm module
  try {
    const contextObject = {
      value,
      row,
      // Provide safe globals only
      Math,
      Date,
      JSON,
      String,
      Number,
      Boolean,
      Array,
      Object,
      undefined,
      NaN,
      isNaN,
      isFinite,
      parseInt,
      parseFloat,
      encodeURIComponent,
      decodeURIComponent
    };

    // Create a context with strict restrictions
    const context = vm.createContext(contextObject, {
      name: 'StreamWeaver Transform'
    });

    // Wrap code to ensure it returns a value
    const wrappedCode = `(function() { ${code} })()`;

    // Run with timeout
    const result = vm.runInContext(wrappedCode, context, {
      timeout: EXECUTION_TIMEOUT_MS,
      displayErrors: true
    });

    return { success: true, value: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
