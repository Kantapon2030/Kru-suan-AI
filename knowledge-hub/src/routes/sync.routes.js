import { Router } from 'express';
import { getExportableEntries, askApprovedKnowledge } from '../services/knowledge.service.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

// Secure all /kb/v1 routes with API key
router.use(apiKeyAuth);

// GET /kb/v1/entries
router.get('/entries', async (req, res, next) => {
  try {
    const { since, isVerified } = req.query;
    const result = await getExportableEntries({
      since,
      isVerified: isVerified !== 'false',
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /kb/v1/ask (Stretch Goal)
router.post('/ask', async (req, res, next) => {
  try {
    const { question, crop, stage, region } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const result = await askApprovedKnowledge(question, { crop, stage, region });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
