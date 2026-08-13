import vm from 'node:vm';

let ivm: any = null;

const loadIsolatedVm = async () => {
  if (ivm !== null) return ivm;
    try {
      // dynamic import; if native addon isn't present the import will fail
      // and we'll fall back to the built-in vm implementation.
      // Silence the compiler about missing declaration files for the
      // optional native dependency.
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

export async function runTransform(
  code: string,
  value: unknown,
  row: Record<string, unknown>
): Promise<SandboxResult> {
  if (!code || !code.trim()) {
    return { success: true, value };
  }

  const isolatedVm = await loadIsolatedVm();
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

  const sandbox = Object.freeze({ value, row });
  const context = vm.createContext({ ...sandbox }, {
    codeGeneration: { strings: false, wasm: false }
  });

  try {
    const wrapped = `(function() {\n${code}\n})()`;
    const script = new vm.Script(wrapped, { filename: 'user-transform.js' });
    const output = script.runInContext(context, { timeout: EXECUTION_TIMEOUT_MS });
    return { success: true, value: output };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
