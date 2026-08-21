import { Transform, TransformCallback, TransformOptions } from 'node:stream';

/**
 * Parses NDJSON (newline-delimited JSON) format where each line is a separate JSON object.
 * Emits each parsed object as it's encountered, without buffering the entire file.
 *
 * Handles:
 * - Complete lines with valid JSON
 * - Empty lines (skipped)
 * - Incomplete final line (buffered for next chunk)
 * - Invalid JSON (emits error event)
 */
export class NDJSONParserStream extends Transform {
  private buffer = '';

  constructor(options: TransformOptions = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    // Append new data to buffer
    this.buffer += chunk.toString('utf8');

    // Split by newlines
    const lines = this.buffer.split('\n');

    // Keep the last line in buffer (might be incomplete)
    this.buffer = lines[lines.length - 1];

    // Process all complete lines
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('//')) {
        // Skip empty lines and comments
        continue;
      }

      try {
        const obj = JSON.parse(line);
        this.push(obj);
      } catch (err) {
        // Emit error but continue processing
        this.emit('data-error', {
          error: err instanceof Error ? err.message : String(err),
          line,
          position: i
        });
      }
    }

    callback();
  }

  _flush(callback: TransformCallback): void {
    // Process any remaining buffered data
    if (this.buffer.trim() !== '' && !this.buffer.trim().startsWith('//')) {
      try {
        const obj = JSON.parse(this.buffer.trim());
        this.push(obj);
      } catch (err) {
        // Emit error for final line
        this.emit('data-error', {
          error: err instanceof Error ? err.message : String(err),
          line: this.buffer.trim(),
          position: 'final'
        });
      }
    }
    callback();
  }
}

/**
 * Wraps a complete JSON file reading into memory with size validation.
 * Used for top-level objects or when safe file size limits are met.
 *
 * Throws if file content exceeds maxSizeBytes.
 */
export async function readAndParseJsonSafely(
  readStream: NodeJS.ReadableStream,
  maxSizeBytes: number = 104857600 // 100 MB default
): Promise<any> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  return new Promise((resolve, reject) => {
    readStream.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxSizeBytes) {
        reject(
          new Error(
            `JSON file exceeds maximum safe size (${maxSizeBytes / 1024 / 1024}MB). ` +
            `Please use streaming format (NDJSON or JSON array) for large files.`
          )
        );
        (readStream as any).destroy?.();
        return;
      }
      chunks.push(chunk);
    });

    readStream.on('end', () => {
      try {
        const data = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    readStream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Detects the first non-whitespace character in a readable stream
 * to determine JSON format (array, object, or NDJSON).
 *
 * Returns the character or empty string if file is empty/whitespace-only.
 */
export async function detectJsonFormat(filePath: string): Promise<string> {
  const fs = await import('node:fs/promises');
  const fd = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
    const content = buffer.slice(0, bytesRead).toString('utf8');
    const match = content.match(/\S/);
    return match ? match[0] : '';
  } finally {
    await fd.close();
  }
}
