import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getUserProfile, updateUserProfile } from '../services/auth.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await getUserProfile(req.userId);
    return successResponse(res, user);
  } catch (err) {
    next(err);
  }
});

router.put('/me', auth, async (req, res, next) => {
  try {
    const updated = await updateUserProfile(req.userId, req.body);
    return successResponse(res, updated, 'แก้ไขโปรไฟล์เรียบร้อยแล้ว');
  } catch (err) {
    next(err);
  }
});

export default router;
