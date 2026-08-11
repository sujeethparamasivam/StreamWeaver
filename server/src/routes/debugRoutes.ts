import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

router.get('/upload-rows', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.query;
    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const filter: any = owners.length ? { createdBy: { $in: owners } } : {};

    if (typeof uploadId === 'string' && uploadId.trim().length > 0) {
      filter.uploadId = uploadId;
    }

    const rows = await UploadRow.find(filter).sort({ rowNumber: 1 }).limit(1000).lean();
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row.data ?? {}))));
    res.json({ count: rows.length, rows, columns });
  } catch (error) {
    res.status(500).json({ message: 'Could not load upload rows', error: String(error) });
  }
});

export default router;
