import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getUserConversations,
  createConversation,
  getConversationDetail,
  sendMessage,
  getQuickActions,
} from '../services/ai/chat.service.js';
import { chatCompletionStream } from '../services/ai/typhoon.client.js';
import { buildContext } from '../services/ai/context.builder.js';
import { buildSystemPrompt } from '../services/ai/prompt.templates.js';
import { successResponse } from '../utils/apiResponse.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.use(auth);

router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await getUserConversations(req.userId);
    return successResponse(res, conversations);
  } catch (err) {
    next(err);
  }
});

router.post('/conversations', async (req, res, next) => {
  try {
    const { plotId, title } = req.body;
    const conversation = await createConversation(req.userId, plotId, title);
    return successResponse(res, conversation, 'เริ่มต้นการสนทนากับครูสวน AI', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await getConversationDetail(req.params.id, req.userId);
    return successResponse(res, conversation);
  } catch (err) {
    next(err);
  }
});

router.post('/message', async (req, res, next) => {
  try {
    const { conversationId, message, plotId } = req.body;
    const content = message || req.body.content;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'ระบุข้อความคำถาม' });
    }

    let convo = null;
    if (conversationId) {
      convo = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: req.userId },
      });
    }

    if (!convo) {
      convo = await createConversation(req.userId, plotId || null, 'ปรึกษาครูสวน AI');
    }

    const { userMessage, aiMessage } = await sendMessage(req.userId, convo.id, content.trim());
    return successResponse(res, {
      conversationId: convo.id,
      reply: aiMessage?.content || '',
      userMessage,
      aiMessage,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'ระบุข้อความคำถาม' });
    }

    const result = await sendMessage(req.userId, req.params.id, content.trim());
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/conversations/:id/messages/stream', async (req, res, next) => {
  try {
    const { content } = req.body;
    const conversationId = req.params.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'ระบุข้อความคำถาม' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.userId },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'ไม่พบการสนทนานี้' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await prisma.message.create({
      data: { conversationId, role: 'user', content: content.trim() },
    });

    const context = await buildContext(
      req.userId,
      conversationId,
      conversation.plotId,
      content.trim()
    );
    const systemPrompt = buildSystemPrompt(context);

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...context.history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: content.trim() },
    ];

    const fullContent = await chatCompletionStream(llmMessages, (chunk) => {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    });

    await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: fullContent,
        metadata: JSON.stringify({
          usedKnowledgeIds: context.knowledge?.map((k) => k.id) || [],
          plotId: conversation.plotId,
        }),
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

router.get('/quick-actions', async (req, res, next) => {
  try {
    const actions = await getQuickActions(req.query.plotId);
    return successResponse(res, actions);
  } catch (err) {
    next(err);
  }
});

export default router;
