import { PrismaClient } from '@prisma/client';
import { chatCompletion } from './typhoon.client.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Proactively analyzes crop health using Typhoon LLM
 */
export async function analyzePlotHealth(plotId) {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: {
      cropCycle: true,
      journalEntries: {
        orderBy: { createdAt: 'desc' },
        take: 7,
      },
      tasks: {
        orderBy: { updatedAt: 'desc' },
        take: 8,
      },
    },
  });

  if (!plot) {
    throw new Error('ไม่พบข้อมูลแปลงที่ระบุ');
  }

  const dayCount = Math.ceil(
    (Date.now() - new Date(plot.plantingDate).getTime()) / 86400000
  );

  const journalSummary = plot.journalEntries.length > 0
    ? plot.journalEntries.map((j) => `[${new Date(j.createdAt).toLocaleDateString('th-TH')}] ${j.emoji || ''} ${j.title}: ${j.content || ''}`).join('\n')
    : 'ยังไม่มีบันทึกอาการล่าสุด';

  const completedTasks = plot.tasks.filter((t) => t.status === 'COMPLETED').map((t) => t.title).join(', ') || 'ไม่มี';
  const pendingTasks = plot.tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS').map((t) => t.title).join(', ') || 'ไม่มี';

  const prompt = `คุณคือระบบวิเคราะห์สุขภาพพืชอัจฉริยะ "ครูสวน AI"
จงวิเคราะห์สุขภาพ ความเสี่ยง และแนวโน้มผลผลิตของแปลงเกษตรนี้:

- พืช: ${plot.cropName} (${plot.cropEmoji || '🌱'})
- ระยะปัจจุบัน: ${plot.cropCycle?.currentStage || 'กำลังเจริญเติบโต'}
- อายุการปลูก: วันที่ ${dayCount} (ความคืบหน้า ${plot.cropCycle?.progress || 0}%)
- ที่ตั้ง/ภูมิภาค: ${plot.location || 'ภาคใต้'}
- ชนิดดิน: ${plot.soilType || 'ดินร่วน'}
- แหล่งน้ำ: ${plot.waterSource || 'น้ำฝน/สปริงเกอร์'}
- ภารกิจที่ทำสำเร็จแล้ว: ${completedTasks}
- ภารกิจที่ค้างอยู่: ${pendingTasks}
- บันทึกการสังเกตล่าสุด:
${journalSummary}

จงตอบกลับเป็นรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "status": "HEALTHY" (เลือก 1 จาก: "EXCELLENT", "HEALTHY", "WARNING", "URGENT"),
  "statusLabel": "สุขภาพสมบูรณ์ดี / เติบโตปกติ / ควรเฝ้าระวัง / ต้องดูแลเร่งด่วน",
  "statusEmoji": "🟢 หรือ 🟡 หรือ 🔴 หรือ 🌟",
  "summary": "สรุปสถานะสุขภาพพืช 1-2 ประโยค",
  "diagnosis": "การวิเคราะห์อาการหรือการเติบโตอย่างละเอียด",
  "risks": ["ความเสี่ยงหรือโรคแมลงที่ต้องระวัง 1", "ความเสี่ยง 2"],
  "recommendations": ["คำแนะนำการดูแล 1", "คำแนะนำ 2", "คำแนะนำ 3"],
  "nextAction": "สิ่งที่เกษตรกรควรทำเป็นลำดับแรกในวันนี้"
}`;

  try {
    const response = await chatCompletion([
      { role: 'system', content: 'You are an agricultural diagnostic system. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 800 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        data: parsed,
        plotId: plot.id,
        analyzedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    logger.error('Health Analysis failed:', err.message);
  }

  // Fallback health status
  return {
    success: true,
    data: {
      status: 'HEALTHY',
      statusLabel: 'ต้นพืชเจริญเติบโตปกติ',
      statusEmoji: '🟢',
      summary: `แปลง ${plot.name} ในระยะ ${plot.cropCycle?.currentStage} กำลังเจริญเติบโตตามรอบวันปลูก`,
      diagnosis: 'การดูแลและให้น้ำเป็นไปตามเกณฑ์ปกติ หมั่นสังเกตใบและยอดอ่อนสม่ำเสมอ',
      risks: ['ความชื้นสูงช่วงฤดูฝนอาจกระตุ้นเชื้อรา', 'วัชพืชแย่งสารอาหาร'],
      recommendations: ['รดน้ำบริเวณโคนต้นสม่ำเสมอ', 'ใส่ปุ๋ยบำรุงตามรอบระยะ', 'สำรวจโรคแมลงใต้ใบ'],
      nextAction: 'ตรวจดูความชื้นหน้าดินและทำภารกิจประจำวันให้ครบ',
    },
    plotId: plot.id,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Automatically records health report into Farm Journal
 */
export async function logHealthReportToJournal(plotId) {
  try {
    const analysis = await analyzePlotHealth(plotId);
    const data = analysis.data;

    const journal = await prisma.journalEntry.create({
      data: {
        plotId,
        type: 'AI_ADVICE',
        emoji: data.statusEmoji || '🤖',
        title: `รายงานสุขภาพพืช: ${data.statusLabel}`,
        content: `${data.summary}\n\n💡 คำแนะนำจากครูสวน AI:\n` +
          data.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') +
          `\n\n🎯 การดูแลเร่งด่วน: ${data.nextAction}`,
        metadata: JSON.stringify(data),
      },
    });

    return journal;
  } catch (err) {
    logger.error('Failed to log health report to journal:', err);
    return null;
  }
}
