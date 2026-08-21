import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  searchRelevantKnowledge,
  createKnowledgeEntry,
  getAllKnowledge,
} from '../services/knowledge.service.js';
import { syncFromKnowledgeHub } from '../services/knowledgeHubSync.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

router.use(auth);

// ดึงองค์ความรู้ที่อนุมัติแล้วจาก Knowledge Hub (System 2) เข้ามาในระบบนี้
router.post('/sync', async (req, res, next) => {
  try {
    const { since } = req.body || {};
    const result = await syncFromKnowledgeHub({ since });
    return successResponse(res, result, `ซิงค์คลังความรู้เรียบร้อยแล้ว (เพิ่มใหม่ ${result.created} รายการ)`);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { crop, topic, stage } = req.query;
    const entries = await getAllKnowledge({ crop, topic, stage });
    return successResponse(res, entries);
  } catch (err) {
    next(err);
  }
});

router.post('/search', async (req, res, next) => {
  try {
    const { crop, stage, query } = req.body;
    const results = await searchRelevantKnowledge(crop, stage, query);
    return successResponse(res, results);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const entry = await createKnowledgeEntry(req.body);
    return successResponse(res, entry, 'เพิ่มคลังภูมิปัญญาเรียบร้อยแล้ว', 201);
  } catch (err) {
    next(err);
  }
});

export default router;
