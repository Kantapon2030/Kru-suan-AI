import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { createConversation } from '../services/ai/chat.service.js';
import { buildAdvisorAssistantConfig } from '../services/ai/vapi.assistant.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

const prisma = new PrismaClient();
const router = Router();

router.use(auth);

// สร้าง/ต่อยอด conversation แล้วคืน config ผู้ช่วยเสียงให้ frontend ส่งต่อให้ Vapi Web SDK
router.post('/start', async (req, res, next) => {
  try {
    if (!env.VAPI_PUBLIC_KEY) {
      return errorResponse(res, 'ยังไม่ได้ตั้งค่า VAPI_PUBLIC_KEY บนเซิร์ฟเวอร์', 500);
    }

    const { plotId, conversationId } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    let conversation = null;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: req.userId },
      });
    }
    if (!conversation) {
      conversation = await createConversation(req.userId, plotId || null);
    }

    const assistant = buildAdvisorAssistantConfig({
      user,
      conversationId: conversation.id,
      plotId: conversation.plotId,
    });

    return successResponse(res, {
      conversationId: conversation.id,
      publicKey: env.VAPI_PUBLIC_KEY,
      assistantId: env.VAPI_ASSISTANT_ID,
      assistant,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
