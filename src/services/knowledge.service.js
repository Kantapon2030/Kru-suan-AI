import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function searchRelevantKnowledge(crop, stage, query = '', region = null) {
  const conditions = [
    { isVerified: true },
  ];

  if (crop) {
    conditions.push({ OR: [{ crop: { contains: crop } }, { crop: 'ALL' }] });
  }

  if (stage) {
    conditions.push({ OR: [{ stage }, { stage: null }] });
  }

  // Filter or prioritize region if provided (e.g., ภาคใต้)
  if (region) {
    conditions.push({ OR: [{ region: { contains: region } }, { region: null }] });
  }

  let entries = await prisma.knowledgeEntry.findMany({
    where: { AND: conditions },
    take: 15,
  });

  if (query) {
    const keywords = query
      .split(/\s+/)
      .filter((k) => k.length > 1);

    if (keywords.length > 0) {
      const keywordEntries = await prisma.knowledgeEntry.findMany({
        where: {
          isVerified: true,
          OR: keywords.flatMap((kw) => [
            { question: { contains: kw } },
            { answer: { contains: kw } },
            { topic: { contains: kw } },
            { subtopic: { contains: kw } },
            { tags: { contains: kw } },
            { crop: { contains: kw } },
          ]),
        },
        take: 15,
      });

      const entryMap = new Map();
      entries.forEach((e) => entryMap.set(e.id, e));
      keywordEntries.forEach((e) => entryMap.set(e.id, e));
      entries = Array.from(entryMap.values());
    }
  }

  // Prioritize exact crop and region matches
  entries.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    if (crop && a.crop === crop) scoreA += 3;
    if (crop && b.crop === crop) scoreB += 3;
    if (region && a.region && a.region.includes(region)) scoreA += 2;
    if (region && b.region && b.region.includes(region)) scoreB += 2;
    if (stage && a.stage === stage) scoreA += 1;
    if (stage && b.stage === stage) scoreB += 1;
    return scoreB - scoreA;
  });

  return entries.slice(0, 8);
}

export async function createKnowledgeEntry(data) {
  return await prisma.knowledgeEntry.create({
    data: {
      ...data,
      isVerified: data.isVerified !== undefined ? data.isVerified : true,
    },
  });
}

export async function getAllKnowledge({ crop, topic, stage }) {
  const where = {};
  if (crop) where.crop = crop;
  if (topic) where.topic = topic;
  if (stage) where.stage = stage;

  return await prisma.knowledgeEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}
