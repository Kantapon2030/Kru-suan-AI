import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatCompletion } from './typhoon.client.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const taskTemplates = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../data/task-templates.json'), 'utf-8')
);

/**
 * Generate dynamic, AI-powered agricultural tasks using Typhoon LLM
 */
export async function generateAITasks(plotContext) {
  const { plot, stage, stageLabel, dayCount, recentJournal = [], location, soilType, waterSource } = plotContext;
  const cropName = plot.cropName;

  try {
    const journalSnippet = recentJournal.length > 0
      ? '- บันทึกล่าสุดในแปลง: ' + recentJournal.map((j) => j.title + ' ' + (j.content || '')).join(' | ')
      : '';

    const prompt = `คุณคือผู้เชี่ยวชาญด้านการเกษตรและระบบวางแผนภารกิจอัจฉริยะ "ครูสวน AI"
จงสร้างภารกิจการดูแลแปลงเกษตรประจำวันจำนวน 2-3 ภารกิจ สำหรับเกษตรกร โดยคำนึงถึงบริบทจริงต่อไปนี้:

- พืชที่ปลูก: ${cropName}
- ระยะการเติบโตปัจจุบัน: ${stage} (${stageLabel || stage})
- วันที่ปลูกมาแล้ว: วันที่ ${dayCount || 1}
- สถานที่/ภูมิภาค: ${location || plot.location || 'ภาคใต้ ประเทศไทย'}
- สภาพดิน: ${soilType || plot.soilType || 'ดินร่วนระบายน้ำดี'}
- แหล่งน้ำ: ${waterSource || plot.waterSource || 'น้ำชลประทาน/น้ำฝน'}
${journalSnippet}

คำแนะนำ:
1. ภารกิจต้องตรงกับระยะการเติบโตของ ${cropName} อย่างแท้จริง โดยเฉพาะการจัดการโรคพืชและสภาพอากาศ
2. คำอธิบายและขั้นตอน (instructions) ต้องเข้าใจง่าย ทำตามได้จริง มีประโยชน์
3. ตอบกลับเป็น JSON Array เท่านั้น ไม่มีข้อความอื่นนอก JSON

ตัวอย่างโครงสร้าง JSON:
[
  {
    "title": "💧 รดน้ำโคนต้นและตรวจความชื้น",
    "description": "รดน้ำช่วงเช้าและตรวจดูความชื้นผิวดิน",
    "emoji": "💧",
    "estimatedTime": 15,
    "instructions": [
      {"step": 1, "text": "สังเกตความชื้นดินรอบโคน"},
      {"step": 2, "text": "รดน้ำชิดโคนต้นเบาๆ"}
    ]
  }
]`;

    const response = await chatCompletion([
      { role: 'system', content: 'You are an agricultural expert system that outputs only valid JSON array of farming tasks.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 1000 });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => ({
          title: t.title,
          description: t.description,
          emoji: t.emoji || '📋',
          estimatedTime: t.estimatedTime || 15,
          instructions: typeof t.instructions === 'string' ? t.instructions : JSON.stringify(t.instructions || []),
        }));
      }
    }
  } catch (err) {
    logger.warn('AI Task Generation failed, falling back to static templates:', err.message);
  }

  const fallback = taskTemplates[cropName]?.[stage] || taskTemplates['DEFAULT']?.[stage] || taskTemplates['DEFAULT']?.['VEGETATIVE'] || [];
  return fallback;
}
