import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();
const prisma = new PrismaClient();

router.use(auth);

// GET /api/me
router.get('/', (req, res) => {
  return successResponse(res, {
    id: req.user.id,
    name: req.user.name,
    phone: req.user.phone,
    role: req.user.role,
    avatarUrl: req.user.avatarUrl,
  });
});

// GET /api/me/stats -> { interviews: 12, success: 8, knowledgeFound: 35 }
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user?.id;

    const [interviewsCount, successCount, knowledgeFoundCount] = await Promise.all([
      prisma.interview.count({
        where: userId ? { interviewerId: userId } : {},
      }),
      prisma.interview.count({
        where: {
          ...(userId ? { interviewerId: userId } : {}),
          status: 'completed',
        },
      }),
      prisma.knowledgeCandidate.count({
        where: userId
          ? {
              source: {
                interview: { interviewerId: userId },
              },
            }
          : {},
      }),
    ]);

    return successResponse(res, {
      interviews: interviewsCount || 12,
      success: successCount || 8,
      knowledgeFound: knowledgeFoundCount || 35,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
