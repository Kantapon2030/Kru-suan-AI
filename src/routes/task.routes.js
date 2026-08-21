import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getTodayTasks, getPlotTasks, startTask, completeTask, addEvidence } from '../services/task.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

router.use(auth);

router.get('/today', async (req, res, next) => {
  try {
    const result = await getTodayTasks(req.userId);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/plot/:plotId', async (req, res, next) => {
  try {
    const tasks = await getPlotTasks(req.params.plotId, req.query.status);
    return successResponse(res, tasks);
  } catch (err) {
    next(err);
  }
});

// Dynamic AI Task Regeneration endpoint
router.post('/plot/:plotId/regenerate', async (req, res, next) => {
  try {
    const { regenerateTasksForPlot } = await import('../services/task.service.js');
    const tasks = await regenerateTasksForPlot(req.params.plotId);
    return successResponse(res, tasks, 'สร้างภารกิจใหม่ด้วย AI สำเร็จ 🌱');
  } catch (err) {
    next(err);
  }
});

router.put('/:id/start', async (req, res, next) => {
  try {
    const task = await startTask(req.params.id);
    return successResponse(res, task, 'เริ่มภารกิจแล้ว');
  } catch (err) {
    next(err);
  }
});

router.put('/:id/complete', async (req, res, next) => {
  try {
    const result = await completeTask(req.params.id, req.body.note);
    return successResponse(res, result, 'ทำภารกิจสำเร็จเก่งมากครับ! 🎉');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/evidence', upload.single('file'), async (req, res, next) => {
  try {
    const type = req.body.type || (req.file ? 'PHOTO' : 'TEXT');
    const content = req.file ? `/uploads/${req.file.filename}` : req.body.content || '';
    const note = req.body.note || '';

    const evidence = await addEvidence(req.params.id, { type, content, note });
    return successResponse(res, evidence, 'บันทึกหลักฐานเรียบร้อยแล้ว');
  } catch (err) {
    next(err);
  }
});

export default router;
