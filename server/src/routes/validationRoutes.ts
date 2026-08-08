import { Router } from 'express';
import ValidationRecord from '../models/ValidationRecord';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { uploadId } = req.query;

  try {
    const query: any = {};
    if (typeof uploadId === 'string') {
      query.uploadId = uploadId;
    }

    const records = await ValidationRecord.find(query).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ records });
  } catch (error) {
    res.status(500).json({ message: 'Could not load validation records', error: String(error) });
  }
});

export default router;
