import { Router } from 'express';
import UploadRow from '../models/UploadRow';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

router.get('/upload-rows', async (req, res) => {
  try {
    const { uploadId } = req.query;
    const filter: any = {};

    if (typeof uploadId === 'string' && uploadId.trim().length > 0) {
      filter.uploadId = uploadId;
    }

    const rows = await UploadRow.find(filter).sort({ rowNumber: 1 }).limit(100).lean();
    res.json({ count: rows.length, rows });
  } catch (error) {
    res.status(500).json({ message: 'Could not load upload rows', error: String(error) });
  }
});

export default router;
