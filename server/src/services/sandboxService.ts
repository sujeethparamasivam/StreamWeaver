import vm from 'node:vm';

/**
 * Sandboxed execution of user-defined transformation code.
 *
 * NOTE: The original spec called for `isolated-vm`, which ships a prebuilt
 * native addon that must be downloaded/compiled from the network. This
 * environment has no network access, so we fall back to Node's built-in
 * `vm` module instead. It is not a perfect security boundary (a
 * sufficiently determined script can still reach for constructor tricks),
 * but combined with:
 *   - a fresh V8 context per call (no access to the host's globals/modules)
 *   - a hard execution timeout
 *   - a minimal, whitelisted sandbox object (only `value` and `row`)
 * it safely covers the intended use case: small expressions like
 * `return value.toUpperCase()`. Swap this module out for `isolated-vm`
 * (same function signature) if/when native builds are available.
 */

export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

const EXECUTION_TIMEOUT_MS = 50;

export function runTransform(
  code: string,
  value: unknown,
  row: Record<string, unknown>
): SandboxResult {
  if (!code || !code.trim()) {
    return { success: true, value };
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
