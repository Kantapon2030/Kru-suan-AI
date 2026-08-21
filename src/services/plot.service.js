import { PrismaClient } from '@prisma/client';
import { getCropDefinition, getOrGenerateCropDefinition, getCropProduceInfo, formatThaiArea } from './crop.service.js';
import { generateStageTasks } from './task.service.js';

const prisma = new PrismaClient();

export async function createPlot(userId, { name, cropName, area, location, soilType, waterSource, plantingDate, treeStatus, treeAgeYears }) {
  const pDate = plantingDate ? new Date(plantingDate) : new Date();
  const dayCount = Math.max(1, Math.ceil((Date.now() - pDate.getTime()) / 86400000));
  const isMature = treeStatus === 'MATURE' || parseFloat(treeAgeYears) >= 4 || dayCount >= 365;

  const cropDef = await getOrGenerateCropDefinition(cropName, { isMature, dayCount, treeStatus });

  const totalDays = cropDef.totalDays || 90;
  const expectedHarvest = new Date(pDate);
  expectedHarvest.setDate(expectedHarvest.getDate() + totalDays);

  let initialStage = cropDef.stages && cropDef.stages.length > 0 ? cropDef.stages[0].name : 'SEED';
  let initialLabel = cropDef.stages && cropDef.stages.length > 0 ? cropDef.stages[0].label : 'เตรียมดินและเมล็ด';
  let initialProgress = cropDef.stages && cropDef.stages.length > 0 ? cropDef.stages[0].progress : 10;

  if (isMature && cropDef.isMatureTree) {
    const activeStage = cropDef.stages[3] || cropDef.stages[0];
    initialStage = activeStage.name;
    initialLabel = activeStage.label;
    initialProgress = activeStage.progress;
  }

  const plot = await prisma.plot.create({
    data: {
      userId,
      name,
      cropName,
      cropEmoji: cropDef.emoji || '🌱',
      area: area ? parseFloat(area) : null,
      location,
      soilType,
      waterSource,
      plantingDate: pDate,
      expectedHarvestDate: expectedHarvest,
      status: 'ACTIVE',
      cropCycle: {
        create: {
          currentStage: initialStage,
          stageStartedAt: new Date(),
          progress: initialProgress,
          stages: {
            create: {
              stage: initialStage,
              startedAt: new Date(),
            },
          },
        },
      },
    },
    include: {
      cropCycle: true,
    },
  });

  const tasks = await generateStageTasks(plot.id, cropName, initialStage);

  await prisma.journalEntry.create({
    data: {
      plotId: plot.id,
      type: 'STAGE_CHANGE',
      emoji: cropDef.emoji || '🌱',
      title: isMature ? `จัดการแปลง ${cropName} (ต้นโตเต็มวัย)` : `เริ่มปลูก ${cropName}`,
      content: isMature
        ? `ลงทะเบียนแปลง ${name} อายุต้นประมาณ ${(dayCount / 365).toFixed(1)} ปี เริ่มต้นในระยะ ${initialLabel}`
        : `สร้างแปลง ${name} เรียบร้อยแล้ว เริ่มต้นระยะ ${initialLabel}`,
    },
  });

  return {
    plot: {
      ...plot,
      areaFormatted: formatThaiArea(plot.area),
      produceInfo: getCropProduceInfo(plot.cropName),
    },
    tasks,
  };
}

export async function getUserPlots(userId, status = 'ACTIVE') {
  const plots = await prisma.plot.findMany({
    where: {
      userId,
      ...(status && { status }),
    },
    include: {
      cropCycle: true,
      tasks: {
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        take: 3,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return plots.map((plot) => {
    const dayCount = Math.max(1, Math.ceil(
      (Date.now() - new Date(plot.plantingDate).getTime()) / 86400000
    ));
    const isMature = dayCount >= 365;
    const cropDef = getCropDefinition(plot.cropName, { isMature, dayCount });

    let currentStage = plot.cropCycle?.currentStage;
    let progress = plot.cropCycle?.progress;
    if (isMature && cropDef.isMatureTree && (currentStage === 'SEED' || currentStage === 'PLANTING' || !currentStage)) {
      const activeStage = cropDef.stages[3] || cropDef.stages[0];
      currentStage = activeStage.label;
      progress = activeStage.progress;
    }

    return {
      ...plot,
      dayCount,
      areaFormatted: formatThaiArea(plot.area),
      produceInfo: getCropProduceInfo(plot.cropName),
      cropCycle: {
        ...plot.cropCycle,
        currentStage: currentStage || plot.cropCycle?.currentStage,
        progress: progress || plot.cropCycle?.progress,
      },
    };
  });
}

export async function getPlotDetail(plotId, userId) {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, userId },
    include: {
      cropCycle: {
        include: { stages: { orderBy: { startedAt: 'asc' } } },
      },
      tasks: { orderBy: { sortOrder: 'asc' } },
      journalEntries: { orderBy: { createdAt: 'desc' }, take: 15 },
      harvests: { orderBy: { date: 'desc' } },
    },
  });

  if (!plot) {
    const err = new Error('ไม่พบข้อมูลแปลงเกษตร');
    err.status = 404;
    throw err;
  }

  const dayCount = Math.max(1, Math.ceil(
    (Date.now() - new Date(plot.plantingDate).getTime()) / 86400000
  ));
  const isMature = dayCount >= 365;

  const cropDef = await getOrGenerateCropDefinition(plot.cropName, { isMature, dayCount });
  const produceInfo = getCropProduceInfo(plot.cropName);

  let currentStage = plot.cropCycle?.currentStage;
  let progress = plot.cropCycle?.progress;

  if (isMature && cropDef.isMatureTree && (currentStage === 'SEED' || currentStage === 'PLANTING' || !currentStage)) {
    const activeStage = cropDef.stages[3] || cropDef.stages[0];
    currentStage = activeStage.name;
    progress = activeStage.progress;
  }

  return {
    ...plot,
    dayCount,
    treeAgeYears: isMature ? (dayCount / 365).toFixed(1) : null,
    isMatureTree: isMature && cropDef.isMatureTree,
    areaFormatted: formatThaiArea(plot.area),
    produceInfo,
    cropDefinition: cropDef,
    cropCycle: {
      ...plot.cropCycle,
      currentStage: currentStage || plot.cropCycle?.currentStage,
      progress: progress || plot.cropCycle?.progress,
    },
  };
}

export async function updatePlot(plotId, userId, data) {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, userId },
  });

  if (!plot) {
    const err = new Error('ไม่พบข้อมูลแปลงเกษตร');
    err.status = 404;
    throw err;
  }

  return prisma.plot.update({
    where: { id: plotId },
    data: {
      name: data.name,
      location: data.location,
      soilType: data.soilType,
      waterSource: data.waterSource,
      area: data.area ? parseFloat(data.area) : undefined,
    },
  });
}

export async function deletePlot(plotId, userId) {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, userId },
  });

  if (!plot) {
    const err = new Error('ไม่พบข้อมูลแปลงเกษตร');
    err.status = 404;
    throw err;
  }

  // 1. Delete task evidences & tasks
  try {
    const tasks = await prisma.task.findMany({ where: { plotId }, select: { id: true } });
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length > 0) {
      await prisma.taskEvidence.deleteMany({ where: { taskId: { in: taskIds } } });
    }
    await prisma.task.deleteMany({ where: { plotId } });
  } catch (e) {}

  // 2. Delete journal entries & harvests
  try {
    await prisma.journalEntry.deleteMany({ where: { plotId } });
    await prisma.harvest.deleteMany({ where: { plotId } });
  } catch (e) {}

  // 3. Delete crop cycles and stage logs
  try {
    const cycle = await prisma.cropCycle.findUnique({ where: { plotId } });
    if (cycle) {
      await prisma.stageLog.deleteMany({ where: { cropCycleId: cycle.id } });
      await prisma.cropCycle.delete({ where: { id: cycle.id } });
    }
  } catch (e) {}

  // 4. Detach conversations
  try {
    await prisma.conversation.updateMany({
      where: { plotId },
      data: { plotId: null },
    });
  } catch (e) {}

  // 5. Delete the plot itself
  await prisma.plot.delete({ where: { id: plotId } });
  return true;
}
