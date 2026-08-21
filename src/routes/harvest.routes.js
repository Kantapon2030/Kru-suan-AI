import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { createHarvest, getPlotHarvests } from '../services/harvest.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router({ mergeParams: true });

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const harvests = await getPlotHarvests(req.params.plotId);
    return successResponse(res, harvests);
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.array('photos', 5), async (req, res, next) => {
  try {
    const photos = req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [];
    const harvest = await createHarvest(req.params.plotId, {
      ...req.body,
      photos,
    });
    return successResponse(res, harvest, 'บันทึกการเก็บเกี่ยวสำเร็จ 🎉', 201);
  } catch (err) {
    next(err);
  }
});

export default router;
