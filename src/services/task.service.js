import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { getNextStage, getCropDefinition, calculateProgress } from './crop.service.js';
import { generateAITasks } from './ai/ai-task.generator.js';
import { logHealthReportToJournal } from './ai/ai-health.analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

export async function generateStageTasks(plotId, cropName, stage) {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: {
      cropCycle: true,
      journalEntries: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  const cropDef = getCropDefinition(cropName);
  const stageDef = cropDef.stages.find((s) => s.name === stage) || { label: stage };
  const dayCount = plot ? Math.ceil((Date.now() - new Date(plot.plantingDate).getTime()) / 86400000) : 1;

  const tasksData = await generateAITasks({
    plot: plot || { cropName },
    stage,
    stageLabel: stageDef.label,
    dayCount,
    recentJournal: plot?.journalEntries || [],
    location: plot?.location,
    soilType: plot?.soilType,
    waterSource: plot?.waterSource,
  });

  const createdTasks = [];
  for (let i = 0; i < tasksData.length; i++) {
    const t = tasksData[i];
    const task = await prisma.task.create({
      data: {
        plotId,
        stage,
        title: t.title,
        description: t.description,
        instructions: typeof t.instructions === 'string' ? t.instructions : JSON.stringify(t.instructions || []),
        emoji: t.emoji || '📋',
        estimatedTime: t.estimatedTime || 15,
        status: 'PENDING',
        dueDate: new Date(),
        sortOrder: i + 1,
      },
    });
    createdTasks.push(task);
  }
  return createdTasks;
}

export async function regenerateTasksForPlot(plotId) {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { cropCycle: true },
  });

  if (!plot || !plot.cropCycle) {
    throw new Error('ไม่พบแปลงหรือระยะการเพาะปลูก');
  }

  // Delete existing pending tasks
  await prisma.task.deleteMany({
    where: {
      plotId,
      status: 'PENDING',
    },
  });

  // Generate new dynamic AI tasks
  return await generateStageTasks(plotId, plot.cropName, plot.cropCycle.currentStage);
}

export async function getTodayTasks(userId) {
  const plots = await prisma.plot.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { id: true, name: true, cropName: true, cropEmoji: true },
  });

  const plotIds = plots.map((p) => p.id);
  const tasks = await prisma.task.findMany({
    where: {
      plotId: { in: plotIds },
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    include: {
      plot: {
        select: { name: true, cropName: true, cropEmoji: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const completedCount = await prisma.task.count({
    where: {
      plotId: { in: plotIds },
      status: 'COMPLETED',
      completedAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  return {
    tasks,
    completedCount,
    totalCount: completedCount + tasks.length,
  };
}

export async function getPlotTasks(plotId, status) {
  const where = { plotId };
  if (status) where.status = status;

  return await prisma.task.findMany({
    where,
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }],
    include: { evidence: true },
  });
}

export async function startTask(taskId) {
  return await prisma.task.update({
    where: { id: taskId },
    data: { status: 'IN_PROGRESS' },
  });
}

export async function completeTask(taskId, note = '') {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { plot: { include: { cropCycle: true } } },
  });

  if (!task) {
    const err = new Error('ไม่พบภารกิจนี้');
    err.statusCode = 404;
    throw err;
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  // Log in Farm Journal
  await prisma.journalEntry.create({
    data: {
      plotId: task.plotId,
      type: 'TASK_COMPLETED',
      emoji: '✅',
      title: `ทำภารกิจสำเร็จ: ${task.title}`,
      content: note || task.description || 'เสร็จเรียบร้อยแล้วครับ 🌱',
      metadata: JSON.stringify({ taskId: task.id, stage: task.stage }),
    },
  });

  // Background health check & diagnosis
  logHealthReportToJournal(task.plotId).catch((e) => console.error('Background health report error:', e));

  // Check if all tasks in this stage are completed
  const remainingPending = await prisma.task.count({
    where: {
      plotId: task.plotId,
      stage: task.stage,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
  });

  let stageAdvanced = false;
  let nextStageInfo = null;

  if (remainingPending === 0) {
    const nextStage = getNextStage(task.plot.cropName, task.stage);
    if (nextStage) {
      stageAdvanced = true;
      nextStageInfo = nextStage;

      const dayCount = Math.ceil(
        (Date.now() - new Date(task.plot.plantingDate).getTime()) / 86400000
      );
      const newProgress = calculateProgress(task.plot.cropName, nextStage.name, dayCount);

      await prisma.cropCycle.update({
        where: { plotId: task.plotId },
        data: {
          currentStage: nextStage.name,
          stageStartedAt: new Date(),
          progress: newProgress,
        },
      });

      await prisma.stageLog.create({
        data: {
          cropCycleId: task.plot.cropCycle.id,
          stage: nextStage.name,
        },
      });

      await generateStageTasks(task.plotId, task.plot.cropName, nextStage.name);

      await prisma.journalEntry.create({
        data: {
          plotId: task.plotId,
          type: 'STAGE_CHANGE',
          emoji: nextStage.emoji || '🎉',
          title: `ก้าวสู่ระยะ: ${nextStage.label}`,
          content: `แปลง ${task.plot.name} เติบโตขึ้นสู่ระยะ ${nextStage.label} แล้วครับ! 🌱`,
        },
      });

      await prisma.notification.create({
        data: {
          userId: task.plot.userId,
          type: 'STAGE_CHANGE',
          title: `🎉 แปลง ${task.plot.name} เลื่อนสู่ระยะ ${nextStage.label}!`,
          body: `ยินดีด้วยครับ! ต้นไม้ของคุณเติบโตขึ้นอีกขั้นแล้ว เข้าไปดูภารกิจใหม่ได้เลย`,
          data: JSON.stringify({ plotId: task.plotId, newStage: nextStage.name }),
        },
      });
    }
  }

  return { task: updatedTask, stageAdvanced, nextStage: nextStageInfo };
}

export async function addEvidence(taskId, { type, content, note }) {
  return await prisma.evidence.create({
    data: {
      taskId,
      type,
      content,
      note,
    },
  });
}
