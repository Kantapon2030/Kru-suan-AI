import { PrismaClient } from '@prisma/client';
import { estimateMarketPrice } from './ai/ai-market.analyzer.js';

const prisma = new PrismaClient();

export async function createHarvest(plotId, { quantity, unit = 'kg', qualityGrade = 'A', photos = [], notes = '' }) {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  if (!plot) {
    const err = new Error('ไม่พบแปลงนี้');
    err.statusCode = 404;
    throw err;
  }

  const harvest = await prisma.harvest.create({
    data: {
      plotId,
      quantity: parseFloat(quantity),
      unit,
      qualityGrade,
      photos: photos.length ? JSON.stringify(photos) : null,
      notes,
    },
  });

  // Calculate AI market price estimation
  let expectedPrice = null;
  let marketEstimate = null;
  try {
    marketEstimate = await estimateMarketPrice({
      cropName: plot.cropName,
      quantity: parseFloat(quantity),
      qualityGrade,
      location: plot.location || 'ภาคใต้',
    });
    expectedPrice = marketEstimate.estimatedPricePerUnit || null;
  } catch (err) {
    console.error('Error estimating price in harvest:', err);
  }

  // Automatically create a market product entry ready for sale
  await prisma.product.create({
    data: {
      harvestId: harvest.id,
      cropName: plot.cropName,
      quantity: parseFloat(quantity),
      unit,
      qualityGrade,
      expectedPrice,
      status: 'READY',
      notes: notes || (marketEstimate ? `ประเมินโดย AI: ${marketEstimate.salesAdvice}` : null),
    },
  });

  // Log in journal with market insights
  const journalContent = marketEstimate
    ? `เก็บเกี่ยวได้ ${quantity} ${unit} (เกรด ${qualityGrade})\n💰 ราคาประเมินตลาด: ${marketEstimate.estimatedPricePerUnit} ${marketEstimate.unit} (มูลค่ารวม ~${marketEstimate.totalEstimatedValue?.toLocaleString()} บาท)\n💡 คำแนะนำการจำหน่าย: ${marketEstimate.salesAdvice}`
    : `เก็บเกี่ยวได้ ${quantity} ${unit} (เกรด ${qualityGrade}) 🎉`;

  await prisma.journalEntry.create({
    data: {
      plotId,
      type: 'OBSERVATION',
      emoji: '🧺',
      title: `บันทึกผลผลิต & ประเมินราคาตลาด ${plot.cropName}`,
      content: journalContent,
      metadata: marketEstimate ? JSON.stringify(marketEstimate) : null,
    },
  });

  return { ...harvest, marketEstimate };
}

export async function getPlotHarvests(plotId) {
  return await prisma.harvest.findMany({
    where: { plotId },
    orderBy: { date: 'desc' },
    include: { product: true },
  });
}
