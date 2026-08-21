import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getPlotJournal(plotId, { page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { plotId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.journalEntry.count({ where: { plotId } }),
  ]);

  return { entries, total, page, limit };
}

export async function addJournalEntry(plotId, { type = 'NOTE', emoji = '📝', title, content, photo, metadata }) {
  return await prisma.journalEntry.create({
    data: {
      plotId,
      type,
      emoji,
      title,
      content,
      photo,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
