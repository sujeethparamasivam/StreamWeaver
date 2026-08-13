import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { isMissingValue, parseValue, getColumnStats, normalizeReplacement } from '../utils/dataUtils';

const router = Router();
router.use(requireAuth);

type MissingColumnSummary = {
  name: string;
  totalRows: number;
  missingValues: number;
  missingPercentage: number;
  completeCount: number;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  sampleValues: unknown[];
};

type MissingDataSummary = {
  totalRows: number;
  rowsWithMissingData: number;
  completeRows: number;
  totalMissingValues: number;
  missingPercentage: number;
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
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import job not found' });

    // get column names via aggregation
    const colsAgg = await UploadRow.aggregate([
      { $match: filter },
      { $project: { kv: { $objectToArray: '$data' } } },
      { $unwind: '$kv' },
      { $group: { _id: null, keys: { $addToSet: '$kv.k' } } },
      { $project: { _id: 0, keys: 1 } }
    ]).allowDiskUse(true);
    const allColumnNames: string[] = (colsAgg[0]?.keys ?? []) as string[];
    const selectedColumnNames = Array.isArray(job.selectedColumns) && job.selectedColumns.length
      ? job.selectedColumns.filter((column) => allColumnNames.includes(column))
      : allColumnNames;

    const totalRows = await UploadRow.countDocuments(filter);
    if (!totalRows) return res.status(404).json({ message: 'No uploaded rows found for this import' });

    let totalMissingValues = 0;
    const columns: MissingColumnSummary[] = [];

    for (const column of selectedColumnNames) {
      const missingValues = await UploadRow.countDocuments({
        ...filter,
        $or: [ { [`data.${column}`]: { $exists: false } }, { [`data.${column}`]: null }, { [`data.${column}`]: '' } ]
      });
      totalMissingValues += missingValues;

      // sample up to 3 non-missing values
      const sample = await UploadRow.aggregate([
        { $match: { ...filter, [`data.${column}`]: { $nin: [null, ''] } } },
        { $project: { v: `$data.${column}` } },
        { $limit: 3 }
      ]).allowDiskUse(true);

      const typeAgg = await UploadRow.aggregate([
        { $match: filter },
        { $project: { t: { $type: `$data.${column}` } } },
        { $group: { _id: '$t', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]).allowDiskUse(true);
      const predominantType = typeAgg[0]?._id ?? 'string';

      columns.push({
        name: column,
        totalRows,
        missingValues,
        missingPercentage: totalRows ? Math.round((missingValues / totalRows) * 10000) / 100 : 0,
        completeCount: totalRows - missingValues,
        type: predominantType === 'double' || predominantType === 'int' || predominantType === 'long' ? 'number' : (predominantType === 'date' ? 'date' : 'string'),
        sampleValues: (sample.map((s: any) => s.v) ?? []).slice(0, 3)
      });
    }

    // rows with any missing column
    const orConditions = selectedColumnNames.map((c) => ({ [`data.${c}`]: { $in: [null, ''] } }));
    const rowsWithMissingData = await UploadRow.countDocuments({ ...filter, $or: orConditions });

    const summary = {
      totalRows,
      rowsWithMissingData,
      completeRows: totalRows - rowsWithMissingData,
      totalMissingValues,
      missingPercentage: totalRows > 0 ? Math.round((rowsWithMissingData / totalRows) * 10000) / 100 : 0
    };

    res.json({ summary, columns });
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
    if (strategy === 'remove') {
      await UploadRow.deleteMany({ uploadId, createdBy: { $in: owners }, $or: [{ [`data.${column}`]: { $exists: false } }, { [`data.${column}`]: null }, { [`data.${column}`]: '' }] });
    } else if (strategy !== 'keep') {
      // compute replacement using aggregations when necessary
      let replacement: any = null;
      if (strategy === 'fill') {
        replacement = normalizeReplacement(fillValue, 'string');
      } else if (strategy === 'mean') {
        const agg = await UploadRow.aggregate([
          { $match: { ...filter, [`data.${column}`]: { $type: 'number' } } },
          { $group: { _id: null, avg: { $avg: `$data.${column}` } } }
        ]).allowDiskUse(true);
        replacement = agg[0]?.avg ?? null;
      } else if (strategy === 'median') {
        const sampleAgg = await UploadRow.aggregate([
          { $match: { ...filter, [`data.${column}`]: { $type: 'number' } } },
          { $sample: { size: 1000 } },
          { $project: { v: `$data.${column}` } }
        ]).allowDiskUse(true);
        const vals = sampleAgg.map((s: any) => Number(s.v)).filter((v: number) => Number.isFinite(v)).sort((a: number, b: number) => a - b);
        if (vals.length) {
          const mid = Math.floor(vals.length / 2);
          replacement = vals.length % 2 === 1 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
        }
      } else if (strategy === 'mode') {
        const modeAgg = await UploadRow.aggregate([
          { $match: { ...filter } },
          { $group: { _id: `$data.${column}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 }
        ]).allowDiskUse(true);
        replacement = modeAgg[0]?._id ?? null;
      }

      if (replacement === null && strategy !== 'mode' && strategy !== 'fill') {
        return res.status(400).json({ message: 'Invalid replacement value for selected strategy' });
      }

      // perform bulk update for missing values
      await UploadRow.updateMany({ ...filter, $or: [{ [`data.${column}`]: { $exists: false } }, { [`data.${column}`]: null }, { [`data.${column}`]: '' }] }, { $set: { [`data.${column}`]: replacement ?? null } });
    }


    await ImportJob.findOneAndUpdate({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }, { updatedAt: new Date() });
    res.json({ message: 'Missing data strategy applied' });
  } catch (error) {
    res.status(500).json({ message: 'Could not apply missing data strategy', error: String(error) });
  }
});

export default router;
