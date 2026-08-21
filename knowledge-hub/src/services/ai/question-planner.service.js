import { PrismaClient } from '@prisma/client';
import { chatCompletion } from './typhoon.client.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export function buildPlannerPrompt({ farmer, crop, freshTopics, coveredTopics, isReturning, totalInterviews }) {
  const farmerName = farmer.displayName || farmer.fullName || 'คุณเกษตรกร';
  const province = farmer.province || 'ไม่ระบุ';
  const years = farmer.yearsExperience || 10;
  const interviewRound = (totalInterviews ?? farmer.totalInterviews ?? 0) + 1;

  let returningSection = '';
  if (isReturning && coveredTopics.length > 0) {
    returningSection = `\nเคยคุยกับเกษตรกรคนนี้มาแล้ว (${coveredTopics.length} หัวข้อ) หัวข้อที่คุยไปแล้ว:\n` +
      coveredTopics.map((c) => `- ${c.topic} (${c.daysAgo} วันก่อน, ความสมบูรณ์ ${(c.completeness * 100).toFixed(0)}%): ${c.summary}`).join('\n') +
      '\n\n*** ห้ามวางแผนถามหัวข้อเหล่านี้ซ้ำ เว้นแต่จะเป็นการ "ต่อยอด" จากที่คุยไว้แล้วจริง ๆ (เช่น ฤดูกาลเปลี่ยนไปแล้ว มีมุมใหม่ที่ยังไม่ได้คุย) ***\n';
  }

  const freshTopicsText = freshTopics.length > 0
    ? freshTopics.join(', ')
    : 'การจัดการศัตรูพืช, การตัดแต่งกิ่ง, การใส่ปุ๋ยบำรุงผล, เทคนิคหลังการเก็บเกี่ยว, การตลาดและช่องทางจำหน่าย';

  return `คุณคือผู้เชี่ยวชาญด้านการเกษตรและนักออกแบบคำถามสัมภาษณ์เชิงลึกสำหรับ "ครูสวน AI"
คุณกำลังวางแผนคำถามสำหรับสัมภาษณ์ ${farmerName} (ประสบการณ์ ${years} ปี จ.${province}) ครั้งที่ ${interviewRound}
พืชที่จะคุย: ${crop}
${returningSection}
หัวข้อที่ยังไม่เคยคุย หรือคุยแล้วแต่ยังไม่ลึกพอ ให้เลือกและต่อยอดจากนี้:
${freshTopicsText}

กติกาการวางแผน:
1. เลือกแค่ 3-5 หัวข้อต่อครั้ง ไม่ต้องพยายามคุยให้ครบทุกอย่างในสายเดียว (ปล่อยให้มีเรื่องเหลือไว้คุยครั้งหน้าได้ เหมือนความสัมพันธ์เพื่อนบ้านที่ค่อย ๆ พัฒนา)
2. เรียงจากเรื่องเบา ๆ/เล่าเรื่อง ไปเรื่องที่ต้องคิดเยอะ/เชิงเทคนิค
3. แต่ละคำถามให้ระบุ "รูปแบบคำถาม" (questionType) โดยเลือกจาก 6 รูปแบบนี้:
   - "เล่าเรื่อง" (เช่น ตอนเริ่มทำใหม่ ๆ เจอปัญหาอะไรที่จำแม่นที่สุด)
   - "เปรียบเทียบอดีต-ปัจจุบัน" (เช่น วิธีดูแลเมื่อ 10 ปีก่อนกับตอนนี้ต่างกันอย่างไร)
   - "ขอคำแนะนำสำหรับรุ่นใหม่" (เช่น ถ้ามีคนรุ่นใหม่มาขอคำแนะนำเรื่องนี้ จะบอกอะไรเป็นข้อแรก)
   - "สมมติสถานการณ์" (เช่น ถ้าปีไหนฝนทิ้งช่วงยาว ๆ มีวิธีรับมืออย่างไร)
   - "ถามความรู้สึก/ความภูมิใจ" (เช่น มีช่วงไหนที่ทำสำเร็จแล้วรู้สึกภูมิใจที่สุด)
   - "ถามข้อเท็จจริงตรง ๆ" (เช่น อัตราการใส่ปุ๋ยต่อน้ำกี่ลิตร ช่วงเวลาไหน)
   * กฎเหล็ก: ห้ามใช้รูปแบบคำถามเดียวกันซ้ำเกิน 2 คำถามติดกัน!
4. ตอบเป็น JSON array เท่านั้น ตามโครงสร้างนี้:
[
  {
    "topicCode": "english_slug",
    "topic": "ชื่อหัวข้อภาษาไทย",
    "question": "คำถามสัมภาษณ์ภาษาไทยที่สุภาพ เป็นกันเอง และเจาะลึก",
    "questionType": "เล่าเรื่อง",
    "priority": 1
  }
]`;
}

export async function generateQuestionPlan({ farmer, crop, topics = [], historyLogs = null }) {
  const requestedTopics = Array.isArray(topics) ? topics : [topics].filter(Boolean);

  // 1. Fetch historical covered topics for this farmer
  let history = historyLogs;
  if (!history && farmer?.id) {
    try {
      history = await prisma.farmerTopicLog.findMany({
        where: { farmerId: farmer.id },
        orderBy: { askedAt: 'desc' },
      });
    } catch (e) {
      logger.warn('Could not query farmerTopicLog:', e.message);
      history = [];
    }
  }
  history = history || [];

  const coveredTopics = history.map((h) => ({
    topic: h.topic,
    summary: h.summary,
    daysAgo: Math.max(0, Math.floor((Date.now() - new Date(h.askedAt).getTime()) / 86400000)),
    completeness: h.completeness ?? 0.5,
  }));

  // Filter fresh topics: not covered, or completeness < 0.7, or asked > 90 days ago
  const freshTopics = requestedTopics.filter((t) => {
    const prior = coveredTopics.find((c) => c.topic === t || (t.includes(c.topic) || c.topic.includes(t)));
    return !prior || prior.completeness < 0.7 || prior.daysAgo > 90;
  });

  const isReturning = (farmer?.totalInterviews > 0) || history.length > 0;
  const totalInterviews = farmer?.totalInterviews || (history.length > 0 ? 1 : 0);

  const prompt = buildPlannerPrompt({
    farmer,
    crop,
    freshTopics: freshTopics.length > 0 ? freshTopics : requestedTopics,
    coveredTopics,
    isReturning,
    totalInterviews,
  });

  try {
    const rawResponse = await chatCompletion([
      {
        role: 'system',
        content: 'You are an agricultural knowledge acquisition expert. Always return strictly valid JSON array matching the required schema.',
      },
      { role: 'user', content: prompt },
    ]);

    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const usedCodes = new Set();
        return parsed.map((item, idx) => {
          let code = item.topicCode || `topic_${idx + 1}`;
          if (usedCodes.has(code)) {
            code = `${code}_${idx + 1}`;
          }
          usedCodes.add(code);

          return {
            topicCode: code,
            topic: item.topic || item.topicCode || `หัวข้อที่ ${idx + 1}`,
            question: item.question,
            questionType: item.questionType || 'ถามข้อเท็จจริงตรง ๆ',
            priority: item.priority || idx + 1,
          };
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to generate question plan with Typhoon, using structured fallback:', error.message);
  }

  // Smart fallback when LLM is unavailable
  return getFallbackQuestionPlan({ crop, coveredTopics, isReturning, freshTopics: freshTopics.length > 0 ? freshTopics : requestedTopics });
}

function getFallbackQuestionPlan({ crop, coveredTopics = [], isReturning = false, freshTopics = [] }) {
  const coveredNames = new Set(coveredTopics.map((c) => c.topic));

  const allCandidateQuestions = [
    {
      topicCode: 'soil_and_land',
      topic: 'การเตรียมดินและการจัดการแปลง',
      question: `ตอนเริ่มเตรียมแปลงปลูก ${crop} ใหม่ ๆ ในพื้นที่ มีเทคนิคการปรับสภาพดินและยกร่องอย่างไรให้รากเดินดีครับ?`,
      questionType: 'เล่าเรื่อง',
      priority: 1,
    },
    {
      topicCode: 'water_management',
      topic: 'การให้น้ำและการจัดการความชื้น',
      question: `เมื่อก่อนกับตอนนี้ วิธีการให้น้ำ ${crop} ช่วงแล้งกับช่วงฝนชุกต่างกันอย่างไร มีข้อสังเกตความชื้นในดินอย่างไรครับ?`,
      questionType: 'เปรียบเทียบอดีต-ปัจจุบัน',
      priority: 2,
    },
    {
      topicCode: 'fertilizer_and_nutrition',
      topic: 'การใส่ปุ๋ยและธาตุอาหาร',
      question: `ถ้ามีเกษตรกรรุ่นใหม่มาถามเรื่องการให้ปุ๋ย ${crop} ในแต่ละระยะ ลุงจะแนะนำสูตรและจังหวะเวลาที่สำคัญที่สุดอย่างไรครับ?`,
      questionType: 'ขอคำแนะนำสำหรับรุ่นใหม่',
      priority: 3,
    },
    {
      topicCode: 'pest_and_disease',
      topic: 'โรคและแมลงศัตรูพืช',
      question: `สมมติว่าช่วงนี้เจอโรคหรือแมลงระบาดหนัก ลุงมีสัญญาณเตือนแรกและวิธีจัดการแบบธรรมชาติหรือเคมีอย่างไรครับ?`,
      questionType: 'สมมติสถานการณ์',
      priority: 4,
    },
    {
      topicCode: 'harvesting_and_quality',
      topic: 'การเก็บเกี่ยวและรักษาคุณภาพ',
      question: `ในการปลูก ${crop} มีช่วงการเก็บเกี่ยวครั้งไหนที่ได้ผลผลิตสวยงามจนรู้สึกภูมิใจที่สุด และมีเคล็ดลับการคัดเกรดอย่างไรครับ?`,
      questionType: 'ถามความรู้สึก/ความภูมิใจ',
      priority: 5,
    },
    {
      topicCode: 'pruning_and_canopy',
      topic: 'การตัดแต่งกิ่งและการดูแลทรงพุ่ม',
      question: `อัตราการตัดแต่งกิ่ง ${crop} และช่วงเวลาที่เหมาะสมในรอบปี ควรทำอย่างไรให้แดดส่องถึงและระบายอากาศดีครับ?`,
      questionType: 'ถามข้อเท็จจริงตรง ๆ',
      priority: 6,
    },
  ];

  // If returning, filter out already covered topics
  let selected = allCandidateQuestions;
  if (isReturning && coveredNames.size > 0) {
    selected = allCandidateQuestions.filter((q) => !coveredNames.has(q.topic) && !coveredNames.has(q.topicCode));
    if (selected.length < 3) {
      // If we ran out of fresh ones, add remaining with extension questions
      selected = allCandidateQuestions;
    }
  }

  return selected.slice(0, 4).map((q, idx) => ({ ...q, priority: idx + 1 }));
}
