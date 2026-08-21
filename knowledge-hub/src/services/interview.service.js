import { PrismaClient } from '@prisma/client';
import { generateQuestionPlan } from './ai/question-planner.service.js';
import { enqueueExtraction } from './ai/extraction.service.js';
import { sseBroadcast } from './sse.service.js';
import { chatCompletion } from './ai/typhoon.client.js';
import { buildSystemPrompt } from './vapi.service.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

export async function findOrCreateFarmer({ phone, fullName, displayName, province, region, yearsExperience, expertiseNote, cropTags }) {
  let existing = null;
  if (phone) {
    existing = await prisma.farmer.findFirst({
      where: { phone },
      include: {
        topicLogs: {
          orderBy: { askedAt: 'desc' },
        },
      },
    });
  }

  if (existing) {
    const updateData = {};
    if (fullName && fullName !== 'เกษตรกร') updateData.fullName = fullName;
    if (displayName && displayName !== 'เกษตรกร') updateData.displayName = displayName;
    if (province && province !== 'ไม่ระบุ') updateData.province = province;
    if (yearsExperience) updateData.yearsExperience = parseInt(yearsExperience, 10);
    if (expertiseNote) updateData.expertiseNote = expertiseNote;

    let updated = existing;
    if (Object.keys(updateData).length > 0) {
      updated = await prisma.farmer.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          topicLogs: {
            orderBy: { askedAt: 'desc' },
          },
        },
      });
    }
    return { farmer: updated, isReturning: true };
  }

  const farmer = await prisma.farmer.create({
    data: {
      fullName: fullName || displayName || 'เกษตรกร',
      displayName: displayName || fullName || 'เกษตรกร',
      phone: phone || null,
      province: province || 'ไม่ระบุ',
      region: region || 'ภาคใต้',
      yearsExperience: parseInt(yearsExperience, 10) || 5,
      expertiseNote: expertiseNote || null,
      cropTags: JSON.stringify(Array.isArray(cropTags) ? cropTags : (cropTags ? [cropTags] : [])),
      consentGranted: true,
    },
    include: {
      topicLogs: true,
    },
  });

  return { farmer, isReturning: false };
}

export async function logCoveredTopics(interview) {
  try {
    const coverage = typeof interview.coverage === 'string' ? JSON.parse(interview.coverage || '{}') : (interview.coverage || {});
    const plan = typeof interview.questionPlan === 'string' ? JSON.parse(interview.questionPlan || '[]') : (interview.questionPlan || []);

    const planMap = new Map();
    plan.forEach((p) => planMap.set(p.topicCode, p));

    for (const [topicCode, info] of Object.entries(coverage)) {
      if (info.status !== 'completed' && info.status !== 'done') continue; // only completed/done topics

      const planItem = planMap.get(topicCode);
      const topicName = info.topic || planItem?.topic || topicCode;
      const subtopic = info.subtopic || null;
      const summary = info.summary || topicName;
      const completeness = typeof info.completeness === 'number' ? info.completeness : 0.7;

      await prisma.farmerTopicLog.create({
        data: {
          farmerId: interview.farmerId,
          interviewId: interview.id,
          crop: interview.source?.crop || interview.crop || null,
          topic: topicName,
          subtopic,
          summary,
          completeness,
        },
      });
    }

    await prisma.farmer.update({
      where: { id: interview.farmerId },
      data: {
        totalInterviews: { increment: 1 },
        lastInterviewAt: new Date(),
      },
    });

    logger.info(`Logged covered topics for farmer ${interview.farmerId} in interview ${interview.id}`);
  } catch (error) {
    logger.error('Error logging covered topics to FarmerTopicLog:', error);
  }
}

export async function createInterview({ farmerData, crop, topics = [], interviewerId }) {
  // 1. Find or create Farmer (handles returning farmer memory)
  const { farmer } = await findOrCreateFarmer({
    phone: farmerData.phone,
    fullName: farmerData.fullName,
    displayName: farmerData.displayName,
    province: farmerData.province,
    region: farmerData.region,
    yearsExperience: farmerData.yearsExperience,
    expertiseNote: farmerData.expertiseNote,
    cropTags: farmerData.cropTags || (crop ? [crop] : []),
  });

  // 2. Create Source
  const source = await prisma.source.create({
    data: {
      type: 'LIVE_CALL',
      title: `สัมภาษณ์ ${farmer.displayName} - ${crop}`,
      status: 'DRAFT',
      licenseBasis: 'farmer_consent',
      crop,
      region: farmer.region,
    },
  });

  // 3. Generate Question Plan with Typhoon LLM (taking past history into account)
  const questionPlan = await generateQuestionPlan({
    farmer,
    crop,
    topics,
    historyLogs: farmer.topicLogs || [],
  });

  // 4. Initialize coverage map
  const coverage = {};
  questionPlan.forEach((q, idx) => {
    coverage[q.topicCode] = {
      status: idx === 0 ? 'in_progress' : 'pending',
      summary: '',
      topic: q.topic || q.topicCode,
      question: q.question,
      questionType: q.questionType,
      completeness: 0,
    };
  });

  // 5. Create Interview
  const interview = await prisma.interview.create({
    data: {
      sourceId: source.id,
      farmerId: farmer.id,
      interviewerId,
      status: 'created',
      questionPlan: JSON.stringify(questionPlan),
      coverage: JSON.stringify(coverage),
    },
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

  return interview;
}

export async function getInterviewById(id) {
  return await prisma.interview.findUnique({
    where: { id },
    include: {
      farmer: {
        include: {
          topicLogs: {
            orderBy: { askedAt: 'desc' },
          },
        },
      },
      source: {
        include: {
          segments: {
            orderBy: { seq: 'asc' },
          },
          candidates: true,
        },
      },
      interviewer: {
        select: { id: true, name: true, phone: true, avatarUrl: true, role: true },
      },
    },
  });
}

export async function listInterviews({ interviewerId, limit = 20, offset = 0 } = {}) {
  const where = {};
  if (interviewerId) {
    where.interviewerId = interviewerId;
  }

  const [total, items] = await Promise.all([
    prisma.interview.count({ where }),
    prisma.interview.findMany({
      where,
      include: {
        farmer: {
          include: {
            topicLogs: {
              orderBy: { askedAt: 'desc' },
            },
          },
        },
        source: {
          include: {
            _count: {
              select: { candidates: true, segments: true },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);

  return { total, items };
}

export async function startInterview(id) {
  const interview = await prisma.interview.update({
    where: { id },
    data: {
      status: 'in_progress',
      startedAt: new Date(),
    },
    include: {
      source: true,
      farmer: {
        include: {
          topicLogs: {
            orderBy: { askedAt: 'desc' },
          },
        },
      },
    },
  });

  await prisma.source.update({
    where: { id: interview.sourceId },
    data: { status: 'IMPORTED' },
  });

  sseBroadcast(id, 'status', { status: 'in_progress', startedAt: interview.startedAt });
  return interview;
}

export async function pauseInterview(id) {
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new Error('Interview not found');

  const nextStatus = interview.status === 'paused' ? 'in_progress' : 'paused';
  const updated = await prisma.interview.update({
    where: { id },
    data: { status: nextStatus },
  });

  sseBroadcast(id, 'status', { status: nextStatus });
  return updated;
}

export async function skipTopic(id) {
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new Error('Interview not found');

  const plan = JSON.parse(interview.questionPlan || '[]');
  const coverage = JSON.parse(interview.coverage || '{}');

  let currentTopicCode = null;
  let nextTopicCode = null;

  for (let i = 0; i < plan.length; i++) {
    const code = plan[i].topicCode;
    if (coverage[code]?.status === 'in_progress') {
      currentTopicCode = code;
      coverage[code] = { ...coverage[code], status: 'skipped', summary: 'ข้ามหัวข้อนี้' };
      if (i + 1 < plan.length) {
        nextTopicCode = plan[i + 1].topicCode;
        coverage[nextTopicCode] = { ...coverage[nextTopicCode], status: 'in_progress' };
      }
      break;
    }
  }

  const updated = await prisma.interview.update({
    where: { id },
    data: { coverage: JSON.stringify(coverage) },
  });

  sseBroadcast(id, 'coverage', coverage);
  if (nextTopicCode) {
    const nextQuestion = plan.find((p) => p.topicCode === nextTopicCode)?.question;
    sseBroadcast(id, 'question', { topicCode: nextTopicCode, question: nextQuestion });
  }

  return updated;
}

export async function addTopic(id, topicTitle) {
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new Error('Interview not found');

  const plan = JSON.parse(interview.questionPlan || '[]');
  const coverage = JSON.parse(interview.coverage || '{}');

  const topicCode = 'custom_' + Date.now();
  const newQuestion = {
    topicCode,
    topic: topicTitle,
    question: topicTitle,
    questionType: 'ถามข้อเท็จจริงตรง ๆ',
    priority: plan.length + 1,
  };

  plan.push(newQuestion);
  coverage[topicCode] = {
    status: 'pending',
    summary: '',
    topic: topicTitle,
    question: topicTitle,
    questionType: 'ถามข้อเท็จจริงตรง ๆ',
    completeness: 0,
  };

  const updated = await prisma.interview.update({
    where: { id },
    data: {
      questionPlan: JSON.stringify(plan),
      coverage: JSON.stringify(coverage),
    },
  });

  sseBroadcast(id, 'coverage', coverage);
  return updated;
}

export async function endInterview(id, { recordingUrl, costUsd } = {}) {
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { source: true, farmer: true },
  });
  if (!interview) throw new Error('Interview not found');

  const endedAt = new Date();
  const startedAt = interview.startedAt || new Date(endedAt.getTime() - 60000);
  const durationSec = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

  const updated = await prisma.interview.update({
    where: { id },
    data: {
      status: 'completed',
      endedAt,
      durationSec,
      recordingUrl: recordingUrl || interview.recordingUrl,
      costUsd: costUsd || interview.costUsd || 0.05,
    },
    include: { source: true, farmer: true },
  });

  await prisma.source.update({
    where: { id: interview.sourceId },
    data: {
      durationSec,
      mediaUrl: recordingUrl || interview.recordingUrl,
    },
  });

  // Log covered topics to FarmerTopicLog and advance farmer totalInterviews
  await logCoveredTopics(updated);

  sseBroadcast(id, 'status', { status: 'completed', durationSec });

  // Trigger background extraction
  setTimeout(() => {
    enqueueExtraction(id);
  }, 500);

  return updated;
}

export function cleanThaiTranscript(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text.trim();

  // 1. Initial phonetic & English filler corrections
  t = t.replace(/^ON\s+/i, 'อ๋อ ');
  t = t.replace(/\bON\b/gi, 'อ๋อ');
  t = t.replace(/\bOK\b/gi, 'โอเค');
  t = t.replace(/ประ\s*ภัสสร\s*ฟ\s*ล\s*า/g, 'ฟอสฟอรัส');
  t = t.replace(/ประภัสสรฟลา/g, 'ฟอสฟอรัส');
  t = t.replace(/ภัสสร\s*ฟ\s*ล\s*า/g, 'ฟอสฟอรัส');
  t = t.replace(/ฟ\s*ล\s*า/g, 'ฟอสฟอรัส');
  t = t.replace(/ร้อย\s*ห้องโถง/g, 'ลองกอง');
  t = t.replace(/ร้อยห้องโถง/g, 'ลองกอง');
  t = t.replace(/สุด\s*ผู้หญิง\s*สีดำ/g, 'สูตรปุ๋ยหมัก');
  t = t.replace(/สุดผู้หญิงสีดำ/g, 'สูตรปุ๋ยหมัก');
  t = t.replace(/สุด\s*ผู้หญิง/g, 'สูตรปุ๋ย');

  // 2. Collapse artificial intra-word spaces between Thai characters
  while (/([\u0E00-\u0E7F])\s+([\u0E00-\u0E7F])/.test(t)) {
    t = t.replace(/([\u0E00-\u0E7F])\s+([\u0E00-\u0E7F])/g, '$1$2');
  }

  // 3. Post-clean common agricultural words & compound terms
  t = t.replace(/ประภัสสรฟลา/g, 'ฟอสฟอรัส');
  t = t.replace(/ร้อยห้องโถง/g, 'ลองกอง');
  t = t.replace(/สุดผู้หญิง/g, 'สูตรปุ๋ย');
  t = t.replace(/ปุยหมัก/g, 'ปุ๋ยหมัก');
  t = t.replace(/ปุย/g, 'ปุ๋ย');
  t = t.replace(/นำ้หมัก/g, 'น้ำหมัก');
  t = t.replace(/นำ้/g, 'น้ำ');

  // Clean spacing after greetings/particles
  t = t.replace(/^(อ๋อ|โอ้โห|สวัสดีครับ|สวัสดีค่ะ)([ก-๙])/g, '$1 $2');

  return t;
}

export async function saveTranscriptSegment(interviewId, { speaker, text, startMs = 0, endMs = 0, confidence = 0.95 }) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) throw new Error('Interview not found');

  const cleanText = cleanThaiTranscript(text);

  const lastSegment = await prisma.transcriptSegment.findFirst({
    where: { sourceId: interview.sourceId },
    orderBy: { seq: 'desc' },
  });

  const nextSeq = (lastSegment?.seq || 0) + 1;
  const safeStartMs = Math.min(Math.max(0, parseInt(startMs, 10) || 0), 2147483647);
  const safeEndMs = Math.min(Math.max(safeStartMs, parseInt(endMs, 10) || safeStartMs + 1000), 2147483647);

  const segment = await prisma.transcriptSegment.create({
    data: {
      sourceId: interview.sourceId,
      seq: nextSeq,
      speaker,
      startMs: safeStartMs,
      endMs: safeEndMs,
      text: cleanText,
      confidence,
    },
  });

  sseBroadcast(interviewId, 'transcript', segment);
  return segment;
}

export async function handleToolCall(interviewId, toolCall) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) throw new Error('Interview not found');

  const coverage = JSON.parse(interview.coverage || '{}');
  const plan = JSON.parse(interview.questionPlan || '[]');
  let insight = null;

  const name = toolCall.function?.name;
  const args = typeof toolCall.function?.arguments === 'string'
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function?.arguments || {};

  if (name === 'mark_topic_covered') {
    const { topicCode, summary, completeness } = args;
    if (coverage[topicCode]) {
      coverage[topicCode].status = 'completed';
      coverage[topicCode].summary = summary || 'ครอบคลุมแล้ว';
      coverage[topicCode].completeness = typeof completeness === 'number' ? completeness : 0.8;
    }

    // Set next topic to in_progress
    const currentIndex = plan.findIndex((p) => p.topicCode === topicCode);
    if (currentIndex >= 0 && currentIndex + 1 < plan.length) {
      const nextCode = plan[currentIndex + 1].topicCode;
      if (coverage[nextCode] && coverage[nextCode].status === 'pending') {
        coverage[nextCode].status = 'in_progress';
      }
    }

    await prisma.interview.update({
      where: { id: interviewId },
      data: { coverage: JSON.stringify(coverage) },
    });
  } else if (name === 'save_insight') {
    const { title, statement, topicCode } = args;
    insight = { title, statement, topicCode };
    logger.info(`Insight captured during live call ${interviewId}:`, insight);
  }

  return {
    coverage,
    insight,
    toolResult: {
      toolCallId: toolCall.id,
      result: 'OK',
    },
  };
}

export async function simulateInterviewTurn(interviewId, farmerInputText) {
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
      source: { include: { segments: true } },
    },
  });
  if (!interview) throw new Error('Interview not found');

  const baseTime = interview.startedAt ? new Date(interview.startedAt).getTime() : Date.now();
  const elapsedMs = Math.max(0, Math.round(Date.now() - baseTime)) % 86400000;

  // 1. Save Farmer's segment
  const farmerSeg = await saveTranscriptSegment(interviewId, {
    speaker: 'farmer',
    text: farmerInputText,
    startMs: elapsedMs,
    endMs: elapsedMs + 2000,
  });

  // 2. Fetch all segments for conversational history
  const allSegments = await prisma.transcriptSegment.findMany({
    where: { sourceId: interview.sourceId },
    orderBy: { seq: 'asc' },
  });

  const messages = [
    { role: 'system', content: buildSystemPrompt(interview, interview.farmer, interview.farmer?.topicLogs || []) },
  ];

  allSegments.slice(-10).forEach((s) => {
    messages.push({
      role: s.speaker === 'farmer' ? 'user' : 'assistant',
      content: s.text,
    });
  });

  // 3. Call Typhoon LLM
  const aiResponse = await chatCompletion(messages);

  // 4. Save AI's response segment
  const aiSeg = await saveTranscriptSegment(interviewId, {
    speaker: 'ai',
    text: aiResponse,
    startMs: elapsedMs + 2000,
    endMs: elapsedMs + 4000,
  });

  // 5. Heuristic coverage advancement check
  const plan = JSON.parse(interview.questionPlan || '[]');
  const coverage = JSON.parse(interview.coverage || '{}');
  let updatedCoverage = false;

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (coverage[p.topicCode]?.status === 'in_progress') {
      coverage[p.topicCode].status = 'completed';
      coverage[p.topicCode].summary = farmerInputText.slice(0, 80);
      coverage[p.topicCode].completeness = 0.8;
      if (i + 1 < plan.length) {
        const next = plan[i + 1];
        coverage[next.topicCode] = { ...coverage[next.topicCode], status: 'in_progress' };
        sseBroadcast(interviewId, 'question', { topicCode: next.topicCode, question: next.question });
      }
      updatedCoverage = true;
      break;
    }
  }

  if (updatedCoverage) {
    await prisma.interview.update({
      where: { id: interviewId },
      data: { coverage: JSON.stringify(coverage) },
    });
    sseBroadcast(interviewId, 'coverage', coverage);
  }

  return { farmerSegment: farmerSeg, aiSegment: aiSeg, coverage };
}
