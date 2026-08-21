import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/sources/:id/transcript
router.get('/:id/transcript', async (req, res, next) => {
  try {
    const { id } = req.params;

    const source = await prisma.source.findUnique({
      where: { id },
      include: {
        interview: {
          include: { farmer: true },
        },
        segments: {
          orderBy: { seq: 'asc' },
        },
      },
    });

    if (!source) {
      return errorResponse(res, 'ไม่พบแหล่งข้อมูล', 404);
    }

    const formattedTranscript = source.segments
      .map((s) => `[${s.speaker === 'ai' ? 'AI' : 'เกษตรกร'}] ${s.text}`)
      .join('\n\n');

    return successResponse(res, {
      sourceId: source.id,
      title: source.title,
      crop: source.crop,
      farmer: source.interview?.farmer,
      segments: source.segments,
      fullText: formattedTranscript,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sources/:id
router.get('/:id', async (req, res, next) => {
  try {
    const source = await prisma.source.findUnique({
      where: { id: req.params.id },
      include: {
        interview: { include: { farmer: true } },
        candidates: true,
      },
    });

    if (!source) {
      return errorResponse(res, 'ไม่พบแหล่งข้อมูล', 404);
    }

    return successResponse(res, source);
  } catch (error) {
    next(error);
  }
});

export default router;
