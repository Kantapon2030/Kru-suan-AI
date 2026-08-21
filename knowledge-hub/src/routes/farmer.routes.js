import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = Router();
const prisma = new PrismaClient();

function formatTimeAgo(date) {
  if (!date) return 'ไม่นานมานี้';
  const diffDays = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (diffDays === 0) return 'วันนี้';
  if (diffDays === 1) return 'เมื่อวาน';
  if (diffDays < 7) return `${diffDays} วันก่อน`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} สัปดาห์ก่อน`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} เดือนก่อน`;
  return `${Math.floor(diffDays / 365)} ปีก่อน`;
}

// GET /api/farmers/lookup?phone=...
router.get('/lookup', async (req, res, next) => {
  try {
    const { phone, name } = req.query;

    if (!phone && !name) {
      return errorResponse(res, 'กรุณาระบุหมายเลขโทรศัพท์หรือชื่อเกษตรกร', 400);
    }

    const where = {};
    if (phone) where.phone = String(phone).trim();
    else if (name) where.fullName = { contains: String(name).trim() };

    const farmer = await prisma.farmer.findFirst({
      where,
      include: {
        topicLogs: {
          orderBy: { askedAt: 'desc' },
          take: 20,
        },
        interviews: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationSec: true,
            source: {
              select: { crop: true, title: true },
            },
          },
        },
      },
    });

    if (!farmer) {
      return successResponse(res, {
        exists: false,
        isReturning: false,
      });
    }

    const coveredTopics = farmer.topicLogs.map((l) => ({
      id: l.id,
      topic: l.topic,
      summary: l.summary,
      crop: l.crop,
      daysAgo: Math.max(0, Math.floor((Date.now() - new Date(l.askedAt).getTime()) / 86400000)),
      completeness: l.completeness,
      askedAt: l.askedAt,
    }));

    // Deduplicate topic names for display
    const uniqueTopicNames = [...new Set(farmer.topicLogs.map((l) => l.topic))];

    const isReturning = farmer.totalInterviews > 0 || coveredTopics.length > 0;
    const lastTimeAgoText = formatTimeAgo(farmer.lastInterviewAt || (farmer.topicLogs[0]?.askedAt));

    return successResponse(res, {
      exists: true,
      isReturning,
      farmer: {
        id: farmer.id,
        fullName: farmer.fullName,
        displayName: farmer.displayName || farmer.fullName,
        phone: farmer.phone,
        province: farmer.province,
        region: farmer.region,
        yearsExperience: farmer.yearsExperience,
        expertiseNote: farmer.expertiseNote,
        cropTags: farmer.cropTags ? JSON.parse(farmer.cropTags) : [],
        totalInterviews: farmer.totalInterviews,
        lastInterviewAt: farmer.lastInterviewAt,
        lastInterviewTimeAgo: lastTimeAgoText,
        coveredTopics,
        coveredTopicNames: uniqueTopicNames,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/farmers
router.get('/', async (req, res, next) => {
  try {
    const farmers = await prisma.farmer.findMany({
      include: {
        _count: {
          select: { interviews: true, topicLogs: true },
        },
        topicLogs: {
          orderBy: { askedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { lastInterviewAt: 'desc' },
    });

    return successResponse(res, farmers);
  } catch (error) {
    next(error);
  }
});

export default router;
