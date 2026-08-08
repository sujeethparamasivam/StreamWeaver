import { Router } from 'express';
import TransformedRow from '../models/TransformedRow';
import ImportJob from '../models/ImportJob';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

router.get('/latest', async (req, res) => {
  try {
    const job = await ImportJob.findOne().sort({ createdAt: -1 }).lean();
    if (!job) return res.status(404).json({ message: 'No imports found' });

    const rows = await TransformedRow.find({ uploadId: job.uploadId }).sort({ rowNumber: 1 }).limit(100).lean();
    res.json({ uploadId: job.uploadId, rows });
  } catch (error) {
    res.status(500).json({ message: 'Could not load latest transformed rows', error: String(error) });
  }
});

router.get('/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const rows = await TransformedRow.find({ uploadId }).sort({ rowNumber: 1 }).limit(100).lean();
    res.json({ rows });
  } catch (error) {
    res.status(500).json({ message: 'Could not load transformed rows', error: String(error) });
  }
});

export default router;
