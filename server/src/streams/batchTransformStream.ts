import { Transform, TransformCallback, TransformOptions } from 'node:stream';

/**
 * Groups individual object-mode records into fixed-size arrays ("batches").
 * Used so the rest of the pipeline can bulk-insert into MongoDB instead of
 * writing one document at a time.
 */
export class BatchTransformStream extends Transform {
  private batch: unknown[] = [];
  private readonly batchSize: number;

  constructor(batchSize: number, options: TransformOptions = {}) {
    super({ ...options, objectMode: true });
    this.batchSize = batchSize;
  }

  _transform(record: unknown, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.batch.push(record);
    if (this.batch.length >= this.batchSize) {
      this.push(this.batch);
      this.batch = [];
    }
    callback();
  }

  _flush(callback: TransformCallback): void {
    if (this.batch.length) {
      this.push(this.batch);
      this.batch = [];
    }
    callback();
  }
}

/**
 * Wraps each raw parsed record with metadata (row number) as it flows
 * through the pipeline, without ever buffering the whole file in memory.
 */
export class RowNumberingStream extends Transform {
  private counter = 0;

  constructor(options: TransformOptions = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(record: unknown, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.counter += 1;
    this.push({ rowNumber: this.counter, data: record });
    callback();
  }
}

/**
 * Passes raw bytes straight through untouched, but reports a running byte
 * count as it goes. Used to drive a live "% of file read" progress signal
 * for large CSV uploads without ever holding the whole file in memory.
 */
export class ByteCounterStream extends Transform {
  public bytesRead = 0;
  private readonly onProgress?: (bytesRead: number) => void;

  constructor(onProgress?: (bytesRead: number) => void, options: TransformOptions = {}) {
    super(options);
    this.onProgress = onProgress;
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.bytesRead += chunk.length;
    this.onProgress?.(this.bytesRead);
    this.push(chunk);
    callback();
  }
}
