import { Router, Response } from 'express';
import ImportJob from '../models/ImportJob';
import UploadRow from '../models/UploadRow';
import TransformedRow from '../models/TransformedRow';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { runTransform } from '../services/sandboxService';

const router = Router();
router.use(requireAuth);

type MappingEntry = string | { source: string; transformCode?: string };

const createJobFilter = (userEmail?: string, userId?: string) => {
  const owners = [userEmail, userId].filter(Boolean) as string[];
  return owners.length ? { createdBy: { $in: owners } } : {};
};

const normalizeMapping = (raw: unknown): Record<string, MappingEntry> => {
  if (!raw || typeof raw !== 'object') return {};

  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, MappingEntry>>((acc, item) => {
      if (item && typeof item === 'object' && 'source' in item && typeof item.source === 'string' && typeof item.dest === 'string' && item.dest.trim()) {
        acc[item.dest] = { source: item.source, transformCode: typeof item.transformCode === 'string' ? item.transformCode : undefined };
      }
      return acc;
    }, {});
  }

  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, MappingEntry>>((acc, [dest, value]) => {
    if (typeof value === 'string') {
      acc[dest] = value;
    } else if (value && typeof value === 'object' && 'source' in value && typeof (value as any).source === 'string') {
      acc[dest] = {
        source: (value as any).source,
        transformCode: typeof (value as any).transformCode === 'string' ? (value as any).transformCode : undefined
      };
    }
    return acc;
  }, {});
};

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const jobs = await ImportJob.find(createJobFilter(req.user?.email, req.user?.id)).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Could not load import history', error: String(error) });
  }
});

router.get('/latest', async (req: AuthedRequest, res: Response) => {
  try {
    const job = await ImportJob.findOne(createJobFilter(req.user?.email, req.user?.id)).sort({ createdAt: -1 }).lean();
    if (!job) return res.status(404).json({ message: 'No imports found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not load latest import', error: String(error) });
  }
});

router.get('/:uploadId', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not load import', error: String(error) });
  }
});

router.patch('/:uploadId/mapping', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const { mapping } = req.body;

    if (!mapping || typeof mapping !== 'object') {
      return res.status(400).json({ message: 'Mapping payload is required' });
    }

    const normalizedMapping = normalizeMapping(mapping);

    const job = await ImportJob.findOneAndUpdate(
      { uploadId, ...createJobFilter(req.user?.email, req.user?.id) },
      { mapping: normalizedMapping, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!job) return res.status(404).json({ message: 'Import not found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not update mapping', error: String(error) });
  }
});

router.patch('/:uploadId/columns', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const { selectedColumns } = req.body;

    if (!Array.isArray(selectedColumns) || selectedColumns.some((column) => typeof column !== 'string')) {
      return res.status(400).json({ message: 'selectedColumns must be an array of strings' });
    }

    const job = await ImportJob.findOneAndUpdate(
      { uploadId, ...createJobFilter(req.user?.email, req.user?.id) },
      { selectedColumns, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!job) return res.status(404).json({ message: 'Import not found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not update selected columns', error: String(error) });
  }
});

// Runs one row through the saved mapping. If a destination field has a
// `transformCode` attached, the user's JavaScript is executed in the
// sandbox (see services/sandboxService.ts) with `value` bound to the
// mapped source value and `row` bound to the whole source row.
const applyMapping = (row: Record<string, unknown>, mapping: Record<string, MappingEntry>) => {
  const output: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [dest, entry] of Object.entries(mapping)) {
    const source = typeof entry === 'string' ? entry : entry.source;
    const transformCode = typeof entry === 'string' ? undefined : entry.transformCode;
    const rawValue = row?.[source];

    if (transformCode) {
      const result = runTransform(transformCode, rawValue, row);
      if (result.success) {
        output[dest] = result.value;
      } else {
        output[dest] = rawValue;
        errors.push(`${dest}: ${result.error}`);
      }
    } else {
      output[dest] = rawValue;
    }
  }

  return { output, errors };
};

router.post('/:uploadId/transform', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email) }).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });
    if (!job.mapping || !Object.keys(job.mapping).length) {
      return res.status(400).json({ message: 'Mapping must be saved before transformation' });
    }

    const mapping = normalizeMapping(job.mapping);
    const rows = await UploadRow.find({ uploadId }).sort({ rowNumber: 1 }).lean();

    if (!rows.length) {
      return res.status(404).json({ message: 'No uploaded rows found for this import' });
    }

    await TransformedRow.deleteMany({ uploadId });

    const sandboxErrors: string[] = [];
    const transformedDocs = rows.map((row: { rowNumber: number; data: Record<string, unknown> }) => {
      const { output, errors } = applyMapping(row.data ?? {}, mapping);
      if (errors.length) sandboxErrors.push(...errors.map((e) => `Row ${row.rowNumber} - ${e}`));
      return { uploadId, rowNumber: row.rowNumber, transformedData: output };
    });

    const BATCH_SIZE = 1000;
    for (let i = 0; i < transformedDocs.length; i += BATCH_SIZE) {
      const chunk = transformedDocs.slice(i, i + BATCH_SIZE);
      await TransformedRow.bulkWrite(
        chunk.map((doc) => ({ insertOne: { document: doc } })),
        { ordered: false }
      );
    }

    await ImportJob.findOneAndUpdate({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }, { transformedAt: new Date() });

    res.json({
      message: 'Transformation complete',
      transformedCount: transformedDocs.length,
      sandboxErrors: sandboxErrors.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not transform rows', error: String(error) });
  }
});

export default router;
