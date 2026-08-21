import { PrismaClient } from '@prisma/client';
import { searchRelevantKnowledge } from '../knowledge.service.js';

const prisma = new PrismaClient();

export async function buildContext(userId, conversationId, plotId, userQuery = '') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, location: true },
  });

  let plotContext = null;
  if (plotId) {
    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      include: { cropCycle: true },
    });

    if (plot) {
      const dayCount = Math.ceil(
        (Date.now() - new Date(plot.plantingDate).getTime()) / 86400000
      );

      const recentTasks = await prisma.task.findMany({
        where: { plotId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { title: true, emoji: true, status: true, stage: true },
      });

      const recentJournal = await prisma.journalEntry.findMany({
        where: { plotId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, emoji: true, content: true, type: true },
      });

      plotContext = {
        plot,
        dayCount,
        recentTasks,
        recentJournal,
      };
    }
  }

  const cropName = plotContext?.plot?.cropName || null;
  const stage = plotContext?.plot?.cropCycle?.currentStage || null;
  const region = user?.location || plotContext?.plot?.location || 'ภาคใต้';

  const knowledge = await searchRelevantKnowledge(cropName, stage, userQuery, region);

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: { role: true, content: true },
  });

  // Calculate current season
  const month = new Date().getMonth() + 1; // 1-12
  let season = 'ฤดูร้อน';
  if (month >= 5 && month <= 10) season = 'ฤดูฝน (มรสุม)';
  else if (month >= 11 || month <= 2) season = 'ฤดูหนาว/หน้าแล้ง';

  return {
    user,
    plotContext,
    knowledge,
    history,
    season,
    region,
  };
}
