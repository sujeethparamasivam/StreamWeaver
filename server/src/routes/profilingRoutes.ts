import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

type ColumnProfile = {
  name: string;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  totalValues: number;
  missingValues: number;
  missingPercentage: number;
  uniqueValues: number;
  duplicateValues: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  mode?: unknown;
};

type DatasetProfile = {
  totalRows: number;
  totalColumns: number;
  totalMissingValues: number;
  totalDuplicateRows: number;
  numberNumericColumns: number;
  numberTextColumns: number;
  numberDateColumns: number;
  datasetSize: number;
  qualityScore: number;
  rowsWithMissingData: number;
  completeRows: number;
  missingDataPercentage: number;
  qualityBreakdown: {
    completeness: number;
    validity: number;
    uniqueness: number;
    consistency: number;
  };
  columns: ColumnProfile[];
};

import { isMissingValue, parseValue, getValueType } from '../utils/dataUtils';


const calculateStats = (values: (number | Date | string | boolean | null)[]) => {
  const nonMissing = values.filter((v) => v !== null) as (number | Date | string | boolean)[];
  const numeric = nonMissing.filter((v): v is number => typeof v === 'number');
  const dates = nonMissing.filter((v): v is Date => v instanceof Date);
  const counts = new Map<string, number>();
  nonMissing.forEach((value) => {
    const key = typeof value === 'object' ? String((value as Date).toISOString()) : String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const sortedNumeric = [...numeric].sort((a, b) => a - b);
  const modeEntry = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  const inferredType: ColumnProfile['type'] = numeric.length ? 'number' : dates.length ? 'date' : nonMissing.length ? 'string' : 'string';
  return {
    uniqueValues: counts.size,
    duplicateValues: nonMissing.length - counts.size,
    min: sortedNumeric.length ? sortedNumeric[0] : undefined,
    max: sortedNumeric.length ? sortedNumeric[sortedNumeric.length - 1] : undefined,
    mean: sortedNumeric.length ? sortedNumeric.reduce((sum, value) => sum + value, 0) / sortedNumeric.length : undefined,
    median: sortedNumeric.length
      ? sortedNumeric.length % 2 === 1
        ? sortedNumeric[(sortedNumeric.length - 1) / 2]
        : (sortedNumeric[sortedNumeric.length / 2 - 1] + sortedNumeric[sortedNumeric.length / 2]) / 2
      : undefined,
    mode: modeEntry ? modeEntry[0] : undefined,
    type: inferredType
  };
};

const createQualityScore = (profile: DatasetProfile) => {
  const completeness = profile.totalRows > 0 ? 100 - Math.round((profile.totalMissingValues / (profile.totalRows * profile.totalColumns)) * 100) : 100;
  const uniqueness = profile.totalRows > 0 ? Math.round(((profile.totalRows - profile.totalDuplicateRows) / profile.totalRows) * 100) : 100;
  const validity = profile.numberNumericColumns + profile.numberDateColumns > 0 ? 95 : 100;
  const consistency = 100 - Math.round(profile.totalDuplicateRows > 0 ? Math.min(20, (profile.totalDuplicateRows / profile.totalRows) * 100) : 0);
  const score = Math.round((completeness + validity + uniqueness + consistency) / 4);
  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { completeness, validity, uniqueness, consistency }
  };
};

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.query;
    if (typeof uploadId !== 'string' || !uploadId.trim()) {
      return res.status(400).json({ message: 'uploadId query parameter is required' });
    }

    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const rowFilter: any = { uploadId, createdBy: { $in: owners } };
    const docs = await UploadRow.find(rowFilter).sort({ rowNumber: 1 }).lean();
    if (!docs.length) return res.status(404).json({ message: 'No uploaded rows found for this import' });

    const columnNames = Array.from(new Set(docs.flatMap((doc) => Object.keys(doc.data ?? {}))));
    const totalRows = docs.length;
    const datasetSize = docs.reduce((sum, doc) => sum + JSON.stringify(doc.data ?? {}).length, 0);

    const columns: ColumnProfile[] = columnNames.map((column) => {
      const values = docs.map((doc) => parseValue(doc.data?.[column]));
      const missingValues = values.filter((v) => v === null).length;
      const totalValues = values.length;
      const stats = calculateStats(values);
      return {
        name: column,
        type: stats.type,
        totalValues,
        missingValues,
        missingPercentage: totalValues ? Math.round((missingValues / totalValues) * 10000) / 100 : 0,
        uniqueValues: stats.uniqueValues,
        duplicateValues: stats.duplicateValues,
        min: stats.type === 'number' ? stats.min : undefined,
        max: stats.type === 'number' ? stats.max : undefined,
        mean: stats.type === 'number' ? stats.mean : undefined,
        median: stats.type === 'number' ? stats.median : undefined,
        mode: stats.mode
      };
    });

    const totalMissingValues = columns.reduce((sum, col) => sum + col.missingValues, 0);
    const duplicateRows = docs.length - new Set(docs.map((doc) => JSON.stringify(doc.data))).size;
    const numberNumericColumns = columns.filter((col) => col.type === 'number').length;
    const numberDateColumns = columns.filter((col) => col.type === 'date').length;
    const numberTextColumns = columns.filter((col) => col.type === 'string').length;
    const rowsWithMissingData = docs.filter((doc) => columnNames.some((column) => isMissingValue(doc.data?.[column]))).length;
    const completeRows = totalRows - rowsWithMissingData;
    const missingDataPercentage = totalRows && columnNames.length
      ? Math.round((totalMissingValues / (totalRows * columnNames.length)) * 100)
      : 0;

    const profile: DatasetProfile = {
      totalRows,
      totalColumns: columns.length,
      totalMissingValues,
      totalDuplicateRows: duplicateRows,
      numberNumericColumns,
      numberTextColumns,
      numberDateColumns,
      datasetSize,
      qualityScore: 0,
      rowsWithMissingData,
      completeRows,
      missingDataPercentage,
      qualityBreakdown: { completeness: 0, validity: 0, uniqueness: 0, consistency: 0 },
      columns
    };

    const quality = createQualityScore(profile);
    profile.qualityScore = quality.score;
    profile.qualityBreakdown = quality.breakdown;

    res.json({ profile });
  } catch (error) {
    res.status(500).json({ message: 'Unable to compute dataset profile', error: String(error) });
  }
});

export default router;
