import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// ดึงองค์ความรู้ที่ทีมงานอนุมัติแล้วจาก Knowledge Hub (System 2)
// แล้วบันทึกเข้า KnowledgeEntry ของระบบนี้ พร้อมกันซิงค์ซ้ำด้วย hubId
export async function syncFromKnowledgeHub({ since } = {}) {
  const url = new URL('/kb/v1/entries', env.KNOWLEDGE_HUB_URL);
  if (since) url.searchParams.set('since', since);

  const res = await fetch(url, {
    headers: { 'x-api-key': env.SYSTEM1_KB_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Knowledge Hub sync failed: HTTP ${res.status}`);
  }

  const { entries = [] } = await res.json();

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const existing = await prisma.knowledgeEntry.findUnique({
      where: { hubId: entry.id },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const saved = await prisma.knowledgeEntry.create({
      data: {
        hubId: entry.id,
        crop: entry.crop,
        topic: entry.topic,
        subtopic: entry.subtopic || null,
        stage: entry.stage || null,
        region: entry.region || null,
        condition: entry.condition || null,
        question: entry.question,
        answer: entry.answer,
        source: entry.source || null,
        tags: Array.isArray(entry.tags) ? JSON.stringify(entry.tags) : entry.tags || null,
        isVerified: true,
      },
    });
    created += 1;

    // แจ้ง Knowledge Hub ว่าองค์ความรู้นี้ถูกส่งออกสำเร็จแล้ว กันส่งซ้ำฝั่งเขาด้วย
    try {
      await fetch(new URL(`/api/knowledge/${entry.id}/mark-exported`, env.KNOWLEDGE_HUB_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportedEntryId: saved.id }),
      });
    } catch (err) {
      logger.warn('ไม่สามารถแจ้ง Knowledge Hub ว่า mark-exported ได้', err.message);
    }
  }

  logger.info(`🔄 Knowledge Hub sync: created=${created} skipped=${skipped} total=${entries.length}`);

  return { created, skipped, total: entries.length };
}
