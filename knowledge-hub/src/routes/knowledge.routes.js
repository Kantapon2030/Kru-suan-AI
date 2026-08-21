import { Router } from 'express';
import {
  getReviewQueue,
  getKnowledgeCandidateById,
  approveCandidate,
  rejectCandidate,
  updateCandidate,
  markExported,
} from '../services/knowledge.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// GET /api/knowledge/queue or /api/review/queue
router.get('/queue', async (req, res, next) => {
  try {
    const { status = 'pending_review', search, limit, offset } = req.query;
    const result = await getReviewQueue({
      status,
      search,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

// GET /api/knowledge/:id
router.get('/:id', async (req, res, next) => {
  try {
    const candidate = await getKnowledgeCandidateById(req.params.id);
    if (!candidate) {
      return errorResponse(res, 'ไม่พบข้อมูลองค์ความรู้', 404);
    }
    return successResponse(res, candidate);
  } catch (error) {
    next(error);
  }
});

// POST /api/knowledge/:id/approve
router.post('/:id/approve', auth, async (req, res, next) => {
  try {
    const reviewerId = req.user?.id;
    const approved = await approveCandidate(req.params.id, reviewerId);
    return successResponse(res, approved, 'อนุมัติองค์ความรู้เรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// POST /api/knowledge/:id/reject
router.post('/:id/reject', auth, async (req, res, next) => {
  try {
    const reviewerId = req.user?.id;
    const { reason } = req.body;
    const rejected = await rejectCandidate(req.params.id, reviewerId, reason);
    return successResponse(res, rejected, 'ปฏิเสธองค์ความรู้เรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// PATCH /api/knowledge/:id
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const updated = await updateCandidate(req.params.id, req.body);
    return successResponse(res, updated, 'แก้ไขข้อมูลองค์ความรู้เรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// POST /api/knowledge/:id/mark-exported
router.post('/:id/mark-exported', async (req, res, next) => {
  try {
    const { exportedEntryId } = req.body;
    const updated = await markExported(req.params.id, { exportedEntryId });
    return successResponse(res, updated, 'บันทึกสถานะการส่งออกเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

export default router;
