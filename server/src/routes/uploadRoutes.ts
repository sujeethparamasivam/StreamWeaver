import { Router, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs, { createReadStream, unlink } from 'node:fs';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import ValidationRecord from '../models/ValidationRecord';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { BatchTransformStream, RowNumberingStream, ByteCounterStream } from '../streams/batchTransformStream';

const router = Router();
const upload = multer({ dest: 'uploads/' });

const BATCH_SIZE = 1000;
const PROGRESS_THROTTLE_MS = 150;

type NumberedRecord = { rowNumber: number; data: Record<string, unknown> };

const validateRow = (row: Record<string, unknown>, uploadId: string, rowNumber: number) => {
  const records: any[] = [];
  const keys = row && typeof row === 'object' ? Object.keys(row) : [];

  if (!keys.length) {
    records.push({ uploadId, rowNumber, field: 'row', message: 'Row contains no fields', severity: 'error', data: row });
    return records;
  }

  for (const key of keys) {
    const value = row[key];
    if (value === '' || value === null || value === undefined) {
      records.push({ uploadId, rowNumber, field: key, message: `Field ${key} is empty`, severity: 'warning', data: row });
    }
  }

  if (typeof row.email === 'string' && !row.email.includes('@')) {
    records.push({ uploadId, rowNumber, field: 'email', message: 'Email value does not appear valid', severity: 'warning', data: row });
  }

  if ((row.created_at || row.createdAt) && Number.isNaN(Date.parse(String(row.created_at ?? row.createdAt)))) {
    records.push({ uploadId, rowNumber, field: 'created_at', message: 'Date field is invalid', severity: 'warning', data: row });
  }

  if (!row.name && !row.fullName && !row.firstName) {
    records.push({ uploadId, rowNumber, field: 'name', message: 'Name field is missing', severity: 'warning', data: row });
  }

  return records;
};

/** Bulk-write a batch of parsed rows (+ their validation issues) in one round trip each. */
const writeBatch = async (batch: NumberedRecord[], fileName: string, uploadId: string) => {
  const rowOps = batch.map(({ rowNumber, data }) => ({
    insertOne: { document: { uploadId, fileName, rowNumber, data } }
  }));

  const validationDocs = batch.flatMap(({ rowNumber, data }) => validateRow(data, uploadId, rowNumber));

  await UploadRow.bulkWrite(rowOps, { ordered: false });
  if (validationDocs.length) {
    await ValidationRecord.bulkWrite(
      validationDocs.map((doc) => ({ insertOne: { document: doc } })),
      { ordered: false }
    );
  }

  return { failedRows: validationDocs.filter((d) => d.severity === 'error').length };
};

router.post('/', requireAuth, upload.single('file'), async (req: AuthedRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const io = req.app.get('io');
  const filePath = path.resolve(req.file.path);
  const extension = path.extname(req.file.originalname).toLowerCase();
  const fileName = req.file.originalname;
  const fileSize = req.file.size;

  // The client generates this id and joins the matching Socket.IO room
  // *before* the upload starts, so progress can be streamed back live.
  const uploadId = (typeof req.body.clientUploadId === 'string' && req.body.clientUploadId.trim())
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let totalRows = 0;
  let failedRows = 0;
  const firstRecords: Record<string, unknown>[] = [];
  const startedAt = Date.now();
  let lastEmit = 0;

  const emitProgress = (bytesRead: number, force = false) => {
    if (!io) return;
    const now = Date.now();
    if (!force && now - lastEmit < PROGRESS_THROTTLE_MS) return;
    lastEmit = now;

    const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001);
    const progress = fileSize > 0 ? Math.min(100, Math.round((bytesRead / fileSize) * 100)) : 0;

    io.to(uploadId).emit('import-progress', {
      uploadId,
      progress,
      rowsProcessed: totalRows,
      rowsFailed: failedRows,
      rowsPerSecond: Math.round(totalRows / elapsedSeconds)
    });
  };

  const job = await ImportJob.create({
    uploadId,
    fileName,
    status: 'processing',
    totalRows: 0,
    failedRows: 0,
    createdBy: req.user?.id,
    startedAt: new Date()
  });

  try {
    let source: NodeJS.ReadableStream;

    if (extension === '.csv') {
      const byteCounter = new ByteCounterStream((bytesRead) => emitProgress(bytesRead));
      source = createReadStream(filePath)
        .pipe(byteCounter)
        .pipe(parse({ columns: true, skip_empty_lines: true }));
    } else if (extension === '.json') {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      emitProgress(fileSize, true);
      source = Readable.from(records);
    } else {
      await ImportJob.findByIdAndUpdate(job._id, { status: 'failed', finishedAt: new Date() });
      return res.status(400).json({ message: 'Unsupported file type' });
    }

    const numbered = source.pipe(new RowNumberingStream());
    const batched = numbered.pipe(new BatchTransformStream(BATCH_SIZE));

    for await (const batch of batched as AsyncIterable<NumberedRecord[]>) {
      const result = await writeBatch(batch, fileName, uploadId);
      totalRows += batch.length;
      failedRows += result.failedRows;
      if (firstRecords.length < 20) firstRecords.push(...batch.slice(0, 20 - firstRecords.length).map((r) => r.data));
      emitProgress(fileSize);
    }

    emitProgress(fileSize, true);

    await ImportJob.findByIdAndUpdate(job._id, {
      status: 'completed',
      totalRows,
      failedRows,
      finishedAt: new Date()
    });

    res.json({ message: 'File processed', fileName, total: totalRows, failedRows, preview: firstRecords, uploadId });
  } catch (error) {
    await ImportJob.findByIdAndUpdate(job._id, { status: 'failed', totalRows, failedRows, finishedAt: new Date() });
    if (io) io.to(uploadId).emit('import-progress', { uploadId, progress: 100, rowsProcessed: totalRows, rowsFailed: failedRows, error: String(error) });
    res.status(500).json({ message: 'Upload processing failed', error: String(error) });
  } finally {
    unlink(filePath, () => undefined);
  }
});

export default router;
