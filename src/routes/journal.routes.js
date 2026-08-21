import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getPlotJournal, addJournalEntry } from '../services/journal.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router({ mergeParams: true });

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const journal = await getPlotJournal(req.params.plotId, { page, limit });
    return successResponse(res, journal);
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('photo'), async (req, res, next) => {
  try {
    const photo = req.file ? `/uploads/${req.file.filename}` : req.body.photo || null;
    const entry = await addJournalEntry(req.params.plotId, {
      ...req.body,
      photo,
    });
    return successResponse(res, entry, 'บันทึกเรียบร้อยแล้ว', 201);
  } catch (err) {
    next(err);
  }
});

export default router;
