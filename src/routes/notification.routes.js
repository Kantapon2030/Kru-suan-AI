import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '../services/notification.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await getUserNotifications(req.userId, unreadOnly);
    return successResponse(res, notifications);
  } catch (err) {
    next(err);
  }
});

router.get('/count', async (req, res, next) => {
  try {
    const result = await getUnreadCount(req.userId);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    await markAsRead(req.params.id, req.userId);
    return successResponse(res, null, 'อ่านการแจ้งเตือนแล้ว');
  } catch (err) {
    next(err);
  }
});

router.put('/read-all', async (req, res, next) => {
  try {
    await markAllAsRead(req.userId);
    return successResponse(res, null, 'อ่านการแจ้งเตือนทั้งหมดแล้ว');
  } catch (err) {
    next(err);
  }
});

export default router;
