import { Router, Response } from 'express';
import ValidationRecord from '../models/ValidationRecord';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res: Response) => {
  const { uploadId } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const skip = (page - 1) * limit;

  try {
    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const query: any = owners.length ? { createdBy: { $in: owners } } : {};
    if (typeof uploadId === 'string') {
      query.uploadId = uploadId;
    }

    const totalRecords = await ValidationRecord.countDocuments(query);
    const totalErrors = await ValidationRecord.countDocuments({ ...query, severity: 'error' });
    const records = await ValidationRecord.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      summary: {
        totalRecords,
        totalErrors,
        totalWarnings: totalRecords - totalErrors
      },
      records,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load validation records', error: String(error) });
  }
});

export default router;
