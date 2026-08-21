import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { typhoonClient } from '../services/ai/typhoon.client.js';
import { buildSystemPrompt, verifyVapiSignature } from '../services/vapi.service.js';
import {
  saveTranscriptSegment,
  handleToolCall,
  endInterview,
} from '../services/interview.service.js';
import { sseBroadcast } from '../services/sse.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const router = Router();
const prisma = new PrismaClient();

// (A) Custom LLM — Vapi calls this turn by turn
router.post('/chat/completions', async (req, res) => {
  try {
    const interviewId = req.body?.call?.metadata?.interviewId || req.body?.metadata?.interviewId;
    let messages = req.body.messages || [];

    if (interviewId) {
      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        include: {
          farmer: {
            include: {
              topicLogs: {
                orderBy: { askedAt: 'desc' },
              },
            },
          },
          source: true,
        },
      });

      if (interview && messages.length > 0) {
        // Inject latest coverage state and farmer history into system prompt
        const systemPrompt = buildSystemPrompt(interview, interview.farmer, interview.farmer?.topicLogs || []);
        if (messages[0].role === 'system') {
          messages[0].content = systemPrompt;
        } else {
          messages.unshift({ role: 'system', content: systemPrompt });
        }
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await typhoonClient.chat.completions.create({
      model: env.TYPHOON_MODEL,
      messages,
      tools: req.body.tools,
      tool_choice: req.body.tool_choice,
      stream: true,
      temperature: 0.4,
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.error('Error in Vapi Custom LLM endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// (B) Webhook — Handles events from Vapi call
router.post('/webhook', async (req, res) => {
  try {
    if (!verifyVapiSignature(req)) {
      logger.warn('Vapi Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const msg = req.body.message || req.body;
    const interviewId = msg?.call?.metadata?.interviewId || msg?.metadata?.interviewId;

    if (!interviewId) {
      return res.json({ ok: true, note: 'No interviewId found in metadata' });
    }

    logger.info(`Received Vapi Webhook event "${msg.type}" for interview ${interviewId}`);

    switch (msg.type) {
      case 'transcript':
        if (msg.transcriptType === 'final' || msg.transcript) {
          const text = msg.transcript || msg.text || '';
          const speaker = msg.role === 'assistant' || msg.speaker === 'assistant' ? 'ai' : 'farmer';
          if (text.trim()) {
            await saveTranscriptSegment(interviewId, {
              speaker,
              text,
              startMs: msg.time || 0,
              endMs: (msg.time || 0) + (msg.duration || 1000),
            });
          }
        }
        break;

      case 'tool-calls':
        if (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
          const results = [];
          for (const tc of msg.toolCalls) {
            const result = await handleToolCall(interviewId, tc);
            sseBroadcast(interviewId, 'coverage', result.coverage);
            if (result.insight) {
              sseBroadcast(interviewId, 'insight', result.insight);
            }
            results.push(result.toolResult);
          }
          return res.json({ results });
        }
        break;

      case 'status-update':
        if (msg.status) {
          await prisma.interview.update({
            where: { id: interviewId },
            data: { status: msg.status },
          });
          sseBroadcast(interviewId, 'status', { status: msg.status });
        }
        break;

      case 'end-of-call-report':
        const recordingUrl = msg.recordingUrl || msg.artifact?.recordingUrl;
        const durationSec = msg.durationSeconds || msg.duration;
        const costUsd = msg.cost;
        await endInterview(interviewId, { recordingUrl, costUsd });
        break;
    }

    return res.json({ ok: true });
  } catch (error) {
    logger.error('Error handling Vapi Webhook:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
