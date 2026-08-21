import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  findOrCreateFarmer,
  createInterview,
  startInterview,
  endInterview,
  getInterviewById,
} from '../services/interview.service.js';
import {
  buildAssistantOverrides,
  buildAssistantConfig,
} from '../services/vapi.service.js';
import { chatCompletion } from '../services/ai/typhoon.client.js';
import { enqueueExtraction } from '../services/ai/extraction.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

const STORY_THEMES = [
  {
    id: 'fertilizer_soil',
    icon: 'eco',
    emoji: '🌱',
    title: 'เคล็ดลับดินดี & ปุ๋ยหมัก 30 ปี',
    subtitle: 'สูตรผสมปุ๋ยอินทรีย์ การปรับดินให้ร่วนซุย และการบำรุงรากพืชให้แข็งแรง',
    defaultTopics: ['การปรับปรุงดิน', 'สูตรปุ๋ยอินทรีย์/น้ำหมัก', 'การบำรุงรักษาดินระยะยาว'],
  },
  {
    id: 'pest_natural',
    icon: 'pest_control',
    emoji: '🐛',
    title: 'ปราบโรคพืช & แมลงฉบับโบราณ',
    subtitle: 'ภูมิปัญญาใช้น้ำหมักสมุนไพรไล่แมลง และเทคนิคตรวจโรคพืชก่อนลุกลาม',
    defaultTopics: ['การสังเกตโรคและแมลงศัตรูพืช', 'สูตรสมุนไพรและน้ำหมักไล่แมลง', 'การป้องกันเชิงรุก'],
  },
  {
    id: 'water_drought',
    icon: 'water_drop',
    emoji: '💧',
    title: 'การจัดการน้ำ & สู้ภัยแล้ง/น้ำท่วม',
    subtitle: 'การวางระบบน้ำ เทคนิคกักเก็บความชื้นในดิน และการปรับตัวต่อสภาพอากาศแปรปรวน',
    defaultTopics: ['ระบบการให้น้ำตามช่วงวัย', 'การรับมือภัยแล้งและฝนทิ้งช่วง', 'การระบายน้ำช่วงฝนตกชุก'],
  },
  {
    id: 'pruning_yield',
    icon: 'content_cut',
    emoji: '✂️',
    title: 'เทคนิคตัดแต่งกิ่ง & เร่งผลดก',
    subtitle: 'การแต่งพุ่มรับแดด การไว้ผลให้ลูกโตสวย และการดูแลผลผลิตให้ได้ราคาดี',
    defaultTopics: ['การตัดแต่งกิ่งเพื่อเปิดทรงพุ่ม', 'การดูแลดอกและการผสมเกสร', 'การคัดขนาดและการเก็บเกี่ยว'],
  },
  {
    id: 'freestyle',
    icon: 'auto_stories',
    emoji: '📖',
    title: 'เล่าประสบการณ์อิสระ (เรื่องที่ภูมิใจที่สุด)',
    subtitle: 'เล่าชีวิตชาวสวน เคล็ดลับเฉพาะตัวที่สั่งสมมา หรือบทเรียนที่อยากบอกคนรุ่นหลัง',
    defaultTopics: ['ประสบการณ์ทำสวนที่ภูมิใจที่สุด', 'บทเรียนสำคัญที่เคยลองผิดลองถูก', 'คำแนะนำถึงคนรุ่นใหม่'],
  },
];

// GET /api/storyteller/topics
router.get('/topics', (req, res) => {
  return successResponse(res, STORY_THEMES);
});

// POST /api/storyteller/start
router.post('/start', async (req, res, next) => {
  try {
    const {
      farmerName,
      phone,
      province,
      crop,
      topicTheme,
      customTopic,
      experience,
    } = req.body;

    const chosenTheme = STORY_THEMES.find((t) => t.id === topicTheme);
    let topics = [];
    if (customTopic && customTopic.trim()) {
      topics = [customTopic.trim()];
    } else if (chosenTheme) {
      topics = chosenTheme.defaultTopics;
    } else {
      topics = ['ประสบการณ์ทำสวนและภูมิปัญญาท้องถิ่น'];
    }

    // 1. Get or create a default system user for interviewerId
    let defaultUser = await prisma.user.findFirst({
      where: { role: { in: ['admin', 'interviewer'] } },
    });

    if (!defaultUser) {
      defaultUser = await prisma.user.create({
        data: {
          name: 'ระบบศาลาปราชญ์เกษตรกร (AI Listener)',
          phone: '0000000000',
          passwordHash: 'system_generated_internal',
          role: 'admin',
        },
      });
    }

    // 2. Prepare Farmer Data
    const nameToUse = (farmerName || '').trim() || 'เกษตรกรผู้มีประสบการณ์';
    const farmerData = {
      fullName: nameToUse,
      displayName: nameToUse,
      phone: phone ? String(phone).trim() : null,
      province: province || 'ไม่ระบุ',
      yearsExperience: parseInt(experience, 10) || 15,
      expertiseNote: chosenTheme ? `สนใจแชร์เรื่อง: ${chosenTheme.title}` : 'แบ่งปันภูมิปัญญาวิถีเกษตรกร',
      cropTags: crop ? [crop] : ['พืชสวน'],
    };

    // 3. Create Interview session
    const interview = await createInterview({
      farmerData,
      crop: crop || 'การเกษตรทั่วไป',
      topics,
      interviewerId: defaultUser.id,
    });

    // 4. Start the interview session immediately
    const started = await startInterview(interview.id);
    const historyLogs = started.farmer?.topicLogs || [];

    const assistantOverrides = buildAssistantOverrides(started, started.farmer, historyLogs);
    const assistantConfig = buildAssistantConfig(started, started.farmer, historyLogs);

    return successResponse(res, {
      interviewId: started.id,
      status: started.status,
      startedAt: started.startedAt,
      publicKey: env.VAPI_PUBLIC_KEY,
      assistantId: env.VAPI_ASSISTANT_ID,
      assistantOverrides,
      assistantConfig,
      farmer: {
        id: started.farmer.id,
        fullName: started.farmer.fullName,
        displayName: started.farmer.displayName,
        province: started.farmer.province,
        yearsExperience: started.farmer.yearsExperience,
        totalInterviews: started.farmer.totalInterviews,
      },
      theme: chosenTheme || { title: customTopic || 'เรื่องเล่าภูมิปัญญา' },
    }, 'เริ่มห้องเล่าเรื่องปราชญ์เกษตรกรเรียบร้อยแล้ว');
  } catch (error) {
    logger.error('Error starting Storyteller session:', error);
    next(error);
  }
});

// POST /api/storyteller/:id/end
router.post('/:id/end', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recordingUrl, costUsd } = req.body;
    const updated = await endInterview(id, { recordingUrl, costUsd });

    // Automatically trigger Typhoon extraction pipeline
    try {
      await enqueueExtraction(id);
    } catch (extractErr) {
      logger.warn('Extraction trigger on end session:', extractErr.message);
    }

    return successResponse(res, updated, 'บันทึกเรื่องเล่าปราชญ์เกษตรกรเรียบร้อยแล้ว');
  } catch (error) {
    logger.error('Error ending Storyteller session:', error);
    next(error);
  }
});

// GET /api/storyteller/:id/summary — Real AI Summarized Wisdom
router.get('/:id/summary', async (req, res, next) => {
  try {
    const { id } = req.params;
    const interview = await getInterviewById(id);

    if (!interview) {
      return errorResponse(res, 'ไม่พบข้อมูลเรื่องเล่านี้', 404);
    }

    const segments = interview.source?.segments || [];
    const candidates = interview.source?.candidates || [];
    const farmerSegments = segments.filter((s) => s.speaker === 'farmer' || s.speaker === 'user');

    let coveredTopics = [];

    // 1. If Typhoon Knowledge Candidates exist in DB, use their real Q&A
    if (candidates && candidates.length > 0) {
      const seenTitles = new Set();
      for (const c of candidates) {
        const title = c.title || c.question;
        if (!seenTitles.has(title)) {
          seenTitles.add(title);
          coveredTopics.push({
            topicCode: c.topic || 'WISDOM',
            topic: title,
            summary: c.answer || c.question,
            completeness: 1.0,
            quote: c.quote || null,
          });
        }
      }
    }

    // 2. If no candidates yet, but transcript segments exist, generate real summary with Typhoon LLM
    if (coveredTopics.length === 0 && segments.length > 0) {
      const fullText = segments.map((s) => `[${s.speaker}]: ${s.text}`).join('\n');
      try {
        const prompt = `คุณคือผู้เชี่ยวชาญสรุปสาระสำคัญภูมิปัญญาการเกษตร
จากบทสนทนาการเล่าเรื่องของเกษตรกร ${interview.farmer?.displayName || 'ปราชญ์เกษตรกร'} ต่อไปนี้:

${fullText}

จงสรุปประเด็นภูมิปัญญาและเทคนิคสำคัญที่เกษตรกรท่านนี้ "เล่าจริงในบทสนทนา" ออกมาเป็น 2-3 ประเด็นที่เข้าใจง่าย มีประโยชน์ต่อเกษตรกรรุ่นใหม่
(ห้ามก๊อปปี้หัวข้อซ้ำ และห้ามใช้ข้อความแม่แบบว่างเปล่า)

ตอบเป็น JSON Array เท่านั้น:
[
  {
    "topic": "ชื่อประเด็นภูมิปัญญา เช่น สูตรน้ำหมักผลไม้บำรุงหน้ายาง",
    "summary": "สรุปสาระสำคัญและวิธีปฏิบัติที่เกษตรกรเล่าอย่างกระชับ..."
  }
]`;

        const response = await chatCompletion([
          { role: 'system', content: 'You are an agricultural expert system that outputs valid JSON array of summarized wisdom points.' },
          { role: 'user', content: prompt },
        ], { temperature: 0.2, maxTokens: 600 });

        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            coveredTopics = parsed.map((p) => ({
              topicCode: 'AI_SUMMARIZED',
              topic: p.topic,
              summary: p.summary,
              completeness: 1.0,
            }));
          }
        }
      } catch (aiErr) {
        logger.warn('Typhoon summary on the fly fallback:', aiErr.message);
      }
    }

    // 3. Fallback to transcript excerpts if AI was unreachable
    if (coveredTopics.length === 0 && farmerSegments.length > 0) {
      coveredTopics = [
        {
          topicCode: 'WISDOM_EXCERPT',
          topic: `ภูมิปัญญาการดูแล ${interview.source?.crop || 'พืช'} จากประสบการณ์จริง`,
          summary: farmerSegments.map((s) => s.text).join(' ').slice(0, 250) + '...',
          completeness: 1.0,
        },
      ];
    }

    // 4. Zero-state if no speech occurred
    if (coveredTopics.length === 0) {
      coveredTopics = [
        {
          topicCode: 'INIT',
          topic: 'การเริ่มต้นแบ่งปันภูมิปัญญา',
          summary: 'เริ่มบันทึกบทสนทนาและองค์ความรู้ปราชญ์ชาวสวน เพื่อสืบทอดสู่ลูกหลานเกษตรกรไทย',
          completeness: 0.5,
        },
      ];
    }

    return successResponse(res, {
      id: interview.id,
      status: interview.status,
      durationSec: interview.durationSec || 0,
      startedAt: interview.startedAt,
      endedAt: interview.endedAt,
      recordingUrl: interview.recordingUrl,
      crop: interview.source?.crop || 'การเกษตร',
      farmer: {
        id: interview.farmer.id,
        fullName: interview.farmer.fullName,
        displayName: interview.farmer.displayName || interview.farmer.fullName,
        province: interview.farmer.province,
        region: interview.farmer.region,
        yearsExperience: interview.farmer.yearsExperience,
        totalInterviews: interview.farmer.totalInterviews,
      },
      coveredTopics,
      farmerTotalWords: farmerSegments.reduce((acc, s) => acc + (s.text ? s.text.length : 0), 0),
      candidatesCount: candidates.length,
      candidates,
    });
  } catch (error) {
    logger.error('Error fetching Storyteller summary:', error);
    next(error);
  }
});

export default router;
