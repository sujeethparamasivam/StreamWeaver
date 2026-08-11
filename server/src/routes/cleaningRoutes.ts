import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { isMissingValue, parseValue, getColumnStats, normalizeReplacement } from '../utils/dataUtils';

const router = Router();
router.use(requireAuth);

type MissingColumnSummary = {
  name: string;
  missingValues: number;
  missingPercentage: number;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  sampleValues: unknown[];
};

type MissingDataRequest = {
  uploadId: string;
  column: string;
  strategy: 'keep' | 'remove' | 'fill' | 'mean' | 'median' | 'mode';
  fillValue?: unknown;
};

const createJobFilter = (userEmail?: string, userId?: string) => {
  const owners = [userEmail, userId].filter(Boolean) as string[];
  return owners.length ? { createdBy: { $in: owners } } : {};
};

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.query;
    if (typeof uploadId !== 'string' || !uploadId.trim()) {
      return res.status(400).json({ message: 'uploadId query parameter is required' });
    }

    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const filter: any = { uploadId, createdBy: { $in: owners } };
    const docs = await UploadRow.find(filter).sort({ rowNumber: 1 }).lean();
    if (!docs.length) return res.status(404).json({ message: 'No uploaded rows found for this import' });

    const columnNames = Array.from(new Set(docs.flatMap((doc) => Object.keys(doc.data ?? {}))));
    const columns: MissingColumnSummary[] = columnNames.map((column) => {
      const values = docs.map((doc) => doc.data?.[column]);
      const parsed = values.map((value) => parseValue(value));
      const missingValues = parsed.filter((value) => isMissingValue(value)).length;
      return {
        name: column,
        missingValues,
        missingPercentage: values.length ? Math.round((missingValues / values.length) * 10000) / 100 : 0,
        type: getColumnStats(values).type,
        sampleValues: values.filter((value) => !isMissingValue(value)).slice(0, 3)
      };
    }).filter((column) => column.missingValues > 0);

    res.json({ columns });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load missing data summary', error: String(error) });
  }
});

router.post('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId, column, strategy, fillValue } = req.body as MissingDataRequest;

    if (!uploadId || !column || !strategy) {
      return res.status(400).json({ message: 'uploadId, column, and strategy are required' });
    }

    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const filter: any = { uploadId, createdBy: { $in: owners } };
    const docs = await UploadRow.find(filter).sort({ rowNumber: 1 }).lean();
    if (!docs.length) return res.status(404).json({ message: 'No uploaded rows found for this import' });

    const values = docs.map((doc) => parseValue(doc.data?.[column]));
    const stats = getColumnStats(values);
    const replacement = strategy === 'fill' ? normalizeReplacement(fillValue, stats.type) : strategy === 'mean' ? stats.mean : strategy === 'median' ? stats.median : strategy === 'mode' ? stats.mode : null;

    if (strategy === 'remove') {
      await UploadRow.deleteMany({ uploadId, createdBy: { $in: owners }, $expr: { $eq: [{ $ifNull: [`$data.${column}`, null] }, null] } });
    } else if (strategy !== 'keep') {
      if (replacement === null && strategy !== 'mode') {
        return res.status(400).json({ message: 'Invalid replacement value for selected strategy' });
      }
      const rows = await UploadRow.find(filter).lean();
      for (const row of rows) {
        const current = parseValue(row.data?.[column]);
        if (isMissingValue(current)) {
          row.data[column] = replacement;
          await UploadRow.updateOne({ _id: row._id }, { data: row.data });
        }
      }
    }

    await ImportJob.findOneAndUpdate({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }, { updatedAt: new Date() });
    res.json({ message: 'Missing data strategy applied' });
  } catch (error) {
    res.status(500).json({ message: 'Could not apply missing data strategy', error: String(error) });
  }
});

export default router;
