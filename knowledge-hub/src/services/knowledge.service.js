import { PrismaClient } from '@prisma/client';
import { chatCompletion } from './ai/typhoon.client.js';

const prisma = new PrismaClient();

export async function getReviewQueue({ status = 'pending_review', search = '', limit = 50, offset = 0 } = {}) {
  const where = {};
  if (status && status !== 'all') {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { question: { contains: search } },
      { answer: { contains: search } },
      { crop: { contains: search } },
      { topic: { contains: search } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.knowledgeCandidate.count({ where }),
    prisma.knowledgeCandidate.findMany({
      where,
      include: {
        source: {
          include: {
            interview: {
              include: { farmer: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);

  const formattedItems = items.map((item) => {
    const farmer = item.source?.interview?.farmer;
    return {
      id: item.id,
      title: item.title,
      crop: item.crop,
      cropTag: item.crop,
      regionTag: item.region || 'ทั่วไป',
      conditionTag: item.condition || 'ปกติ',
      extractedContent: item.answer,
      question: item.question,
      answer: item.answer,
      confidence: item.confidence,
      confidencePercent: Math.round(item.confidence * 100),
      riskLevel: item.riskLevel,
      status: item.status,
      quote: item.quote,
      tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags,
      farmerName: farmer?.displayName || farmer?.fullName || 'เกษตรกร',
      traceability: {
        interviewNumber: item.source?.interview?.id ? `#${item.source.interview.id.slice(-4)}` : '#001',
        farmerName: farmer?.displayName || farmer?.fullName || 'เกษตรกร',
        farmerRole: 'เกษตรกร',
        transcriptUrl: `/api/sources/${item.sourceId}/transcript`,
      },
      createdAt: item.createdAt,
    };
  });

  return { total, items: formattedItems };
}

export async function getKnowledgeCandidateById(id) {
  const item = await prisma.knowledgeCandidate.findUnique({
    where: { id },
    include: {
      source: {
        include: {
          interview: {
            include: { farmer: true },
          },
          segments: {
            orderBy: { seq: 'asc' },
          },
        },
      },
      reviewer: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  if (!item) return null;

  const farmer = item.source?.interview?.farmer;

  return {
    id: item.id,
    title: item.title,
    crop: item.crop,
    cropTag: item.crop,
    regionTag: item.region || 'ทั่วไป',
    conditionTag: item.condition || 'ปกติ',
    topic: item.topic,
    subtopic: item.subtopic,
    stage: item.stage,
    region: item.region,
    condition: item.condition,
    question: item.question,
    answer: item.answer,
    extractedContent: item.answer,
    quote: item.quote,
    confidence: item.confidence,
    confidencePercent: Math.round(item.confidence * 100),
    riskLevel: item.riskLevel,
    status: item.status,
    tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags,
    provenanceText: item.provenanceText,
    traceability: {
      interviewId: item.source?.interview?.id,
      interviewNumber: item.source?.interview?.id ? `#${item.source.interview.id.slice(-4)}` : '#001',
      farmerName: farmer?.displayName || farmer?.fullName || 'เกษตรกร',
      farmerRole: 'เกษตรกร',
      farmerProvince: farmer?.province,
      transcriptUrl: `/api/sources/${item.sourceId}/transcript`,
      sourceTitle: item.source?.title,
    },
    reviewer: item.reviewer,
    reviewedAt: item.reviewedAt,
    rejectReason: item.rejectReason,
    createdAt: item.createdAt,
    segments: item.source?.segments || [],
  };
}

export async function approveCandidate(id, reviewerId) {
  const item = await prisma.knowledgeCandidate.findUnique({ where: { id } });
  if (!item) throw new Error('Candidate not found');

  const updated = await prisma.knowledgeCandidate.update({
    where: { id },
    data: {
      status: 'approved',
      reviewedById: reviewerId || null,
      reviewedAt: new Date(),
    },
  });

  return updated;
}

export async function rejectCandidate(id, reviewerId, rejectReason = 'ไม่ผ่านเกณฑ์การตรวจสอบ') {
  const item = await prisma.knowledgeCandidate.findUnique({ where: { id } });
  if (!item) throw new Error('Candidate not found');

  const updated = await prisma.knowledgeCandidate.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectReason,
      reviewedById: reviewerId || null,
      reviewedAt: new Date(),
    },
  });

  return updated;
}

export async function updateCandidate(id, data) {
  const updatePayload = {};

  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.crop !== undefined) updatePayload.crop = data.crop;
  if (data.topic !== undefined) updatePayload.topic = data.topic;
  if (data.subtopic !== undefined) updatePayload.subtopic = data.subtopic;
  if (data.stage !== undefined) updatePayload.stage = data.stage;
  if (data.region !== undefined) updatePayload.region = data.region;
  if (data.condition !== undefined) updatePayload.condition = data.condition;
  if (data.question !== undefined) updatePayload.question = data.question;
  if (data.answer !== undefined) updatePayload.answer = data.answer;
  if (data.tags !== undefined) {
    updatePayload.tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags;
  }
  if (data.status !== undefined) updatePayload.status = data.status;

  return await prisma.knowledgeCandidate.update({
    where: { id },
    data: updatePayload,
  });
}

export async function getExportableEntries({ since, isVerified = true } = {}) {
  const where = {
    status: 'approved',
  };

  if (since) {
    where.createdAt = { gte: new Date(since) };
  }

  const candidates = await prisma.knowledgeCandidate.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  const entries = candidates.map((c) => {
    let parsedTags = [];
    try {
      parsedTags = typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags;
    } catch {
      parsedTags = [c.crop, c.topic].filter(Boolean);
    }

    return {
      id: c.id,
      crop: c.crop,
      topic: c.topic,
      subtopic: c.subtopic,
      stage: c.stage,
      region: c.region,
      condition: c.condition,
      question: c.question,
      answer: c.answer,
      source: c.provenanceText,
      tags: parsedTags,
      isVerified: true,
    };
  });

  return {
    entries,
    nextSince: new Date().toISOString(),
  };
}

export async function markExported(id, { exportedEntryId } = {}) {
  return await prisma.knowledgeCandidate.update({
    where: { id },
    data: {
      exportedAt: new Date(),
      exportedEntryId: exportedEntryId || id,
    },
  });
}

export async function askApprovedKnowledge(query, { crop, stage, region } = {}) {
  const where = { status: 'approved' };
  if (crop) where.crop = crop;
  if (stage) where.stage = stage;
  if (region) where.region = region;

  const candidates = await prisma.knowledgeCandidate.findMany({
    where,
    take: 10,
  });

  const contextText = candidates
    .map((c) => `[พืช: ${c.crop} | หัวข้อ: ${c.topic}]\nคำถาม: ${c.question}\nคำตอบ: ${c.answer}\nแหล่งที่มา: ${c.provenanceText}`)
    .join('\n\n');

  const prompt = `คุณคือผู้ช่วย AI ครูสวน ตอบคำถามของเกษตรกรโดยอ้างอิงจากคลังภูมิปัญญาที่ให้ไว้เท่านั้น

คลังภูมิปัญญา:
${contextText || 'ยังไม่มีข้อมูลเฉพาะในคลัง'}

คำถามของเกษตรกร:
${query}

กรุณาตอบอย่างสุภาพ อธิบายเข้าใจง่าย ชัดเจน พร้อมระบุแหล่งที่มาอ้างอิง`;

  const answer = await chatCompletion([
    { role: 'system', content: 'You are ครูสวน AI farming assistant.' },
    { role: 'user', content: prompt },
  ]);

  return {
    query,
    answer,
    referencedSources: candidates.map((c) => ({ id: c.id, title: c.title, source: c.provenanceText })),
  };
}
