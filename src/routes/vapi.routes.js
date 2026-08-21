import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { chatCompletionStream } from '../services/ai/typhoon.client.js';
import { buildContext } from '../services/ai/context.builder.js';
import { buildVoiceSystemPrompt } from '../services/ai/prompt.templates.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
const router = Router();

// Custom LLM ของ Vapi Assistant #2 — เรียก retrieval/context เดิมของ /api/chat ซ้ำ
// (buildContext -> searchRelevantKnowledge) แล้ว stream คำตอบกลับในฟอร์แมต OpenAI-compatible
router.post('/chat/completions', async (req, res) => {
  const userId = req.query.userId;
  const conversationId = req.query.conversationId;

  if (!userId || !conversationId) {
    return res.status(400).json({ error: 'missing userId/conversationId in query string' });
  }

  try {
    const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const userQuestion = [...incomingMessages].reverse().find((m) => m.role === 'user')?.content || '';

    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    const context = await buildContext(userId, conversationId, conversation?.plotId || null, userQuestion);
    const systemPrompt = buildVoiceSystemPrompt(context);

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...incomingMessages.filter((m) => m.role !== 'system'),
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamId = `chatcmpl-${Date.now()}`;
    const chunkHeader = {
      id: streamId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: env.TYPHOON_MODEL,
    };

    await chatCompletionStream(llmMessages, (delta) => {
      res.write(`data: ${JSON.stringify({
        ...chunkHeader,
        choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
      })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({
      ...chunkHeader,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error('Vapi custom-llm error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal error' });
    } else {
      res.end();
    }
  }
});

// Webhook ของ Vapi — บันทึก transcript ลงตาราง Message เดิม (channel=voice) + อัปเดต VoiceSession
router.post('/webhook', async (req, res) => {
  try {
    const msg = req.body?.message;
    if (!msg) return res.json({ ok: true });

    const userId = req.query.userId || msg?.call?.metadata?.userId;
    const conversationId = req.query.conversationId || msg?.call?.metadata?.conversationId;
    const vapiCallId = msg?.call?.id;

    if (msg.type === 'status-update' && vapiCallId && userId) {
      await prisma.voiceSession.upsert({
        where: { vapiCallId },
        update: { status: msg.status === 'ended' ? 'completed' : 'in_progress' },
        create: { vapiCallId, userId, conversationId, status: 'in_progress' },
      });
    }

    if (msg.type === 'transcript' && msg.transcriptType === 'final' && conversationId && msg.transcript?.trim()) {
      await prisma.message.create({
        data: {
          conversationId,
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.transcript.trim(),
          channel: 'voice',
        },
      });
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }).catch(() => {});
    }

    if (msg.type === 'end-of-call-report' && vapiCallId && userId) {
      const durationSec = Math.round(
        msg.durationSeconds ?? (msg.durationMs ? msg.durationMs / 1000 : 0)
      ) || null;
      const failed = msg.endedReason && !['assistant-ended-call', 'customer-ended-call'].includes(msg.endedReason);

      await prisma.voiceSession.upsert({
        where: { vapiCallId },
        update: { status: failed ? 'failed' : 'completed', endedAt: new Date(), durationSec },
        create: {
          vapiCallId,
          userId,
          conversationId,
          status: failed ? 'failed' : 'completed',
          endedAt: new Date(),
          durationSec,
        },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error('Vapi webhook error:', err);
    res.json({ ok: true });
  }
});

export default router;
