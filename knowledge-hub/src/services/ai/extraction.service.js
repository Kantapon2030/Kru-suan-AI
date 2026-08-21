import { PrismaClient } from '@prisma/client';
import { chatCompletion } from './typhoon.client.js';
import { logger } from '../../utils/logger.js';
import { sseBroadcast } from '../sse.service.js';

const prisma = new PrismaClient();

const ALLOWED_CROPS = ['ทุเรียน', 'ยางพารา', 'ปาล์มน้ำมัน', 'มะเขือเทศ', 'มังคุด', 'ลองกอง', 'สะตอ', 'ขมิ้น', 'ALL'];
const ALLOWED_STAGES = ['SEED', 'SEEDLING', 'PLANTING', 'VEGETATIVE', 'FLOWERING', 'FRUIT', 'HARVEST'];

export async function extractKnowledgeFromTranscript(fullText, source, farmer) {
  const prompt = `คุณคือผู้เชี่ยวชาญจัดการความรู้เกษตร สกัด "คู่คำถาม-คำตอบ" จากบทสนทนานี้

กฎ:
1. สกัดเฉพาะสิ่งที่เกษตรกรพูดจริงเท่านั้น ห้ามเติมความรู้เอง
2. question ต้องเป็นคำถามที่เกษตรกรคนอื่นน่าจะถามจริง (ไม่ใช่ชื่อหัวข้อ)
3. answer ต้องมีตัวเลข/เงื่อนไข/ขั้นตอนถ้ามีพูดถึง
4. แนบ quote คำพูดต้นฉบับคำต่อคำเสมอ (ใช้ตรวจสอบภายหลัง)
5. crop ให้เลือกจากลิสต์นี้เท่านั้น: ทุเรียน, ยางพารา, ปาล์มน้ำมัน, มะเขือเทศ, มังคุด, ลองกอง, สะตอ, ขมิ้น, ALL (ถ้าเป็นพืชอื่นให้เลือกพืชที่ใกล้เคียงที่สุดหรือ ALL)
6. stage ถ้าระบุได้ ใช้ค่านี้เท่านั้น: SEED, SEEDLING, PLANTING, VEGETATIVE, FLOWERING, FRUIT, HARVEST
7. contains_chemical = true ถ้าพูดถึงสารเคมี ยาฆ่าแมลง ฮอร์โมน หรือปริมาณยา

บริบท: เกษตรกร ${farmer?.displayName || farmer?.fullName || 'เกษตรกร'} (${farmer?.province || 'ไม่ระบุจังหวัด'}) ประสบการณ์ ${farmer?.yearsExperience || 10} ปี

บทสนทนา:
${fullText}

ตอบเป็น JSON เท่านั้น ตาม schema:
{
  "units": [
    {
      "title": "ชื่อสรุปสั้นๆ เช่น การให้น้ำมะเขือเทศ",
      "crop": "มะเขือเทศ",
      "topic": "การจัดการน้ำ",
      "subtopic": "การรดน้ำช่วงอากาศร้อน",
      "stage": "FRUIT",
      "region": "ภาคใต้",
      "condition": "อากาศร้อน",
      "question": "มะเขือเทศควรรดน้ำอย่างไรในช่วงอากาศร้อนไม่ให้ดอกร่วง",
      "answer": "เนื้อหาคำตอบแบบละเอียด มีขั้นตอนและตัวเลขชัดเจน...",
      "tags": ["มะเขือเทศ", "การให้น้ำ", "อากาศร้อน"],
      "quote": "คำพูดจริงจากบทสนทนาคำต่อคำ",
      "confidence": 0.85,
      "containsChemical": false
    }
  ]
}`;

  try {
    const rawResponse = await chatCompletion([
      { role: 'system', content: 'You are an expert agricultural knowledge extraction engine. You extract structured Q&A units in strict JSON format.' },
      { role: 'user', content: prompt },
    ]);

    const jsonMatch = rawResponse.match(/\{[\s\S]*"units"[\s\S]*\}/) || rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && Array.isArray(parsed.units)) {
        return parsed;
      }
    }
  } catch (error) {
    logger.error('Error during Typhoon knowledge extraction:', error);
  }

  // Fallback heuristic extraction if LLM fails
  return {
    units: [
      {
        title: `การดูแล${source.crop || 'พืช'}จากประสบการณ์จริง`,
        crop: ALLOWED_CROPS.includes(source.crop) ? source.crop : 'ALL',
        topic: 'การดูแลรักษา',
        subtopic: null,
        stage: null,
        region: source.region || null,
        condition: null,
        question: `มีเทคนิคและแนวทางการดูแล${source.crop || 'พืช'}อย่างไรให้ได้ผลผลิตสูง`,
        answer: fullText.replace(/\[.*?\]\s*/g, ' ').slice(0, 400).trim(),
        tags: [source.crop || 'พืช', 'การดูแล'],
        quote: fullText.slice(0, 100),
        confidence: 0.7,
        containsChemical: false,
      },
    ],
  };
}

export async function enqueueExtraction(interviewId) {
  try {
    logger.info(`Starting knowledge extraction pipeline for interview ${interviewId}...`);

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { source: true, farmer: true },
    });

    if (!interview || !interview.source) {
      throw new Error(`Interview ${interviewId} or its source not found`);
    }

    const sourceId = interview.source.id;

    // 1. Set status to PROCESSING
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'PROCESSING' },
    });
    sseBroadcast(interviewId, 'status', { status: 'PROCESSING' });

    // 2. Fetch transcript segments
    const segments = await prisma.transcriptSegment.findMany({
      where: { sourceId },
      orderBy: { seq: 'asc' },
    });

    const fullText = segments.map((s) => `[${s.speaker}] ${s.text}`).join('\n');

    if (!fullText.trim()) {
      logger.warn(`No transcript found for source ${sourceId}, skipping extraction.`);
      await prisma.source.update({
        where: { id: sourceId },
        data: { status: 'IN_REVIEW' },
      });
      sseBroadcast(interviewId, 'status', { status: 'IN_REVIEW' });
      return;
    }

    // 3. Extract knowledge with Typhoon
    const result = await extractKnowledgeFromTranscript(fullText, interview.source, interview.farmer);

    // 4. Validate and score candidates
    const validCandidates = [];
    const farmerName = interview.farmer.displayName || interview.farmer.fullName;
    const provenanceText = `สัมภาษณ์เกษตรกร ${farmerName} (${interview.farmer.province || 'ไม่ระบุจังหวัด'})`;

    for (const unit of result.units || []) {
      let confidence = typeof unit.confidence === 'number' ? unit.confidence : 0.75;

      // Check quote existence in transcript
      if (unit.quote && !fullText.includes(unit.quote)) {
        // Soft match or penalty
        confidence *= 0.4;
      }

      if (confidence < 0.35) {
        logger.info(`Candidate "${unit.title}" dropped due to low confidence (${confidence})`);
        continue;
      }

      const riskLevel = unit.containsChemical ? 'chemical' : 'normal';
      const crop = ALLOWED_CROPS.includes(unit.crop) ? unit.crop : ALLOWED_CROPS.includes(interview.source.crop) ? interview.source.crop : 'ALL';
      const stage = ALLOWED_STAGES.includes(unit.stage) ? unit.stage : null;

      validCandidates.push({
        sourceId,
        title: unit.title || `ความรู้เรื่อง ${unit.topic || crop}`,
        crop,
        topic: unit.topic || 'ทั่วไป',
        subtopic: unit.subtopic || null,
        stage,
        region: unit.region || interview.source.region || null,
        condition: unit.condition || null,
        question: unit.question,
        answer: unit.answer,
        provenanceText,
        tags: JSON.stringify(Array.isArray(unit.tags) ? unit.tags : [crop, unit.topic].filter(Boolean)),
        quote: unit.quote || '',
        confidence: Math.min(Math.max(confidence, 0.1), 1.0),
        riskLevel,
        status: 'pending_review',
        extractionModel: 'typhoon-v2.5-30b-a3b-instruct',
      });
    }

    // 5. Save candidates in database
    for (const candidateData of validCandidates) {
      const saved = await prisma.knowledgeCandidate.create({
        data: candidateData,
      });
      logger.info(`Created KnowledgeCandidate: "${saved.title}" (id: ${saved.id}, confidence: ${saved.confidence})`);
      sseBroadcast(interviewId, 'insight', {
        id: saved.id,
        title: saved.title,
        question: saved.question,
        confidence: saved.confidence,
      });
    }

    // 6. Update status to IN_REVIEW
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'IN_REVIEW' },
    });

    sseBroadcast(interviewId, 'status', { status: 'IN_REVIEW' });
    logger.info(`Extraction complete for interview ${interviewId}. Status set to IN_REVIEW.`);
  } catch (error) {
    logger.error('Error in extraction pipeline:', error);
    try {
      const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
      if (interview) {
        await prisma.source.update({
          where: { id: interview.sourceId },
          data: { status: 'ERROR', errorMessage: error.message },
        });
        sseBroadcast(interviewId, 'status', { status: 'ERROR', error: error.message });
      }
    } catch (e) {
      logger.error('Failed to update source error status:', e);
    }
  }
}
