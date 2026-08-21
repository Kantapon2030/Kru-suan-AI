import { Router } from 'express';
import {
  createInterview,
  getInterviewById,
  listInterviews,
  startInterview,
  pauseInterview,
  skipTopic,
  addTopic,
  endInterview,
  simulateInterviewTurn,
} from '../services/interview.service.js';
import { buildAssistantOverrides, buildAssistantConfig } from '../services/vapi.service.js';
import { sseSubscribe } from '../services/sse.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { auth } from '../middleware/auth.js';
import { env } from '../config/env.js';

const router = Router();

// GET /api/interviews
router.get('/', auth, async (req, res, next) => {
  try {
    const mine = req.query.mine === '1';
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const interviewerId = mine && req.user ? req.user.id : undefined;
    const result = await listInterviews({ interviewerId, limit, offset });

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

// POST /api/interviews
router.post('/', auth, async (req, res, next) => {
  try {
    const { farmerName, area, experience, expertise, crop, topics, phone } = req.body;

    const farmerData = {
      fullName: farmerName || 'เกษตรกร',
      displayName: farmerName || 'เกษตรกร',
      phone: phone || null,
      province: area || 'ไม่ระบุ',
      yearsExperience: experience,
      expertiseNote: expertise,
      cropTags: crop ? [crop] : [],
    };

    const interviewerId = req.user?.id;
    const interview = await createInterview({
      farmerData,
      crop: crop || 'ทั่วไป',
      topics: topics || [],
      interviewerId,
    });

    return successResponse(res, interview, 'สร้างการสัมภาษณ์เรียบร้อยแล้ว', 201);
  } catch (error) {
    next(error);
  }
});

// GET /api/interviews/:id
router.get('/:id', async (req, res, next) => {
  try {
    const interview = await getInterviewById(req.params.id);
    if (!interview) {
      return errorResponse(res, 'ไม่พบข้อมูลการสัมภาษณ์', 404);
    }
    return successResponse(res, interview);
  } catch (error) {
    next(error);
  }
});

// POST /api/interviews/:id/start
router.post('/:id/start', async (req, res, next) => {
  try {
    if (!env.VAPI_PUBLIC_KEY || !env.VAPI_ASSISTANT_ID) {
      return errorResponse(res, 'ยังไม่ได้ตั้งค่า VAPI_PUBLIC_KEY หรือ VAPI_ASSISTANT_ID บนเซิร์ฟเวอร์', 500);
    }

    const interview = await startInterview(req.params.id);
    const historyLogs = interview.farmer?.topicLogs || [];
    const assistantOverrides = buildAssistantOverrides(interview, interview.farmer, historyLogs);
    const assistantConfig = buildAssistantConfig(interview, interview.farmer, historyLogs);

    return successResponse(res, {
      interviewId: interview.id,
      status: interview.status,
      startedAt: interview.startedAt,
      publicKey: env.VAPI_PUBLIC_KEY,
      assistantId: env.VAPI_ASSISTANT_ID,
      assistantOverrides,
      assistantConfig,
    }, 'เริ่มการสัมภาษณ์เรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// GET /api/interviews/:id/stream & /api/interviews/:id/events (SSE)
const handleSSEStream = async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  // Send initial state
  const interview = await getInterviewById(id);
  if (interview) {
    const coverage = JSON.parse(interview.coverage || '{}');
    const plan = JSON.parse(interview.questionPlan || '[]');
    const currentTopic = plan.find((p) => coverage[p.topicCode]?.status === 'in_progress');

    res.write(`event: init\ndata: ${JSON.stringify({
      status: interview.status,
      coverage,
      questionPlan: plan,
      currentQuestion: currentTopic?.question || plan[0]?.question,
      segments: interview.source?.segments || [],
    })}\n\n`);
  }

  sseSubscribe(id, res);
};

router.get('/:id/stream', handleSSEStream);
router.get('/:id/events', handleSSEStream);

// POST /api/interviews/:id/pause
router.post('/:id/pause', async (req, res, next) => {
  try {
    const updated = await pauseInterview(req.params.id);
    return successResponse(res, updated, 'สลับสถานะการสัมภาษณ์เรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// POST /api/interviews/:id/skip-topic
router.post('/:id/skip-topic', async (req, res, next) => {
  try {
    const updated = await skipTopic(req.params.id);
    return successResponse(res, updated, 'ข้ามหัวข้อเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// POST /api/interviews/:id/add-topic
router.post('/:id/add-topic', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return errorResponse(res, 'กรุณาระบุชื่อหัวข้อ', 400);

    const updated = await addTopic(req.params.id, title);
    return successResponse(res, updated, 'เพิ่มหัวข้อเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// POST /api/interviews/:id/end
router.post('/:id/end', async (req, res, next) => {
  try {
    const { recordingUrl, costUsd } = req.body;
    const updated = await endInterview(req.params.id, { recordingUrl, costUsd });
    return successResponse(res, updated, 'จบการสัมภาษณ์และเริ่มสกัดความรู้เรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
});

// POST /api/interviews/:id/extract — Trigger Typhoon AI Knowledge Extraction
router.post('/:id/extract', async (req, res, next) => {
  try {
    const { enqueueExtraction } = await import('../services/ai/extraction.service.js');
    const result = await enqueueExtraction(req.params.id);
    return successResponse(res, result, 'สกัดองค์ความรู้ด้วย Typhoon AI สำเร็จแล้ว ⚡');
  } catch (error) {
    next(error);
  }
});

// POST /api/interviews/:id/simulate-turn & /:id/turn
const handleTurn = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return errorResponse(res, 'กรุณากรอกข้อความของเกษตรกร', 400);

    const result = await simulateInterviewTurn(req.params.id, text);
    return successResponse(res, result, 'จำลองการตอบคำถามเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
};

router.post('/:id/simulate-turn', handleTurn);
router.post('/:id/turn', handleTurn);

export default router;
