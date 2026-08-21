import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPlot, getUserPlots, getPlotDetail, updatePlot, deletePlot } from '../services/plot.service.js';
import { getOrGenerateCropDefinition, getCropProduceInfo, formatThaiArea, parseThaiArea } from '../services/crop.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

const createPlotSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'ระบุชื่อแปลง'),
    cropName: z.string().min(1, 'ระบุพืชที่ปลูก'),
    area: z.number().optional().or(z.string().transform(v => parseFloat(v) || null)).nullable(),
    rai: z.number().optional().or(z.string().transform(v => parseFloat(v) || 0)),
    ngan: z.number().optional().or(z.string().transform(v => parseFloat(v) || 0)),
    sqWa: z.number().optional().or(z.string().transform(v => parseFloat(v) || 0)),
    location: z.string().optional(),
    soilType: z.string().optional(),
    waterSource: z.string().optional(),
    plantingDate: z.string().optional(),
  }),
});

router.use(auth);

// GET /api/plots — Get user plots
router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'ACTIVE';
    const plots = await getUserPlots(req.userId, status);
    return successResponse(res, plots);
  } catch (err) {
    next(err);
  }
});

// POST /api/plots/preview-crop — Preview or Generate Crop Specs with AI
router.post('/preview-crop', async (req, res, next) => {
  try {
    const { cropName } = req.body;
    if (!cropName) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อพืช' });
    }
    const cropDef = await getOrGenerateCropDefinition(cropName);
    const produceInfo = getCropProduceInfo(cropName);
    return successResponse(res, { cropDef, produceInfo }, 'ดึงข้อมูลพืชสำเร็จ');
  } catch (err) {
    next(err);
  }
});

// POST /api/plots — Create new plot
router.post('/', validate(createPlotSchema), async (req, res, next) => {
  try {
    let finalArea = req.body.area;
    if (!finalArea && (req.body.rai !== undefined || req.body.ngan !== undefined || req.body.sqWa !== undefined)) {
      finalArea = parseThaiArea(req.body.rai, req.body.ngan, req.body.sqWa);
    }

    const result = await createPlot(req.userId, {
      ...req.body,
      area: finalArea,
    });
    return successResponse(res, result, 'สร้างแปลงเกษตรสำเร็จ', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/plots/:id — Plot details
router.get('/:id', async (req, res, next) => {
  try {
    const plot = await getPlotDetail(req.params.id, req.userId);
    return successResponse(res, plot);
  } catch (err) {
    next(err);
  }
});

// GET /api/plots/:id/health-report — AI Health Report
router.get('/:id/health-report', async (req, res, next) => {
  try {
    const { analyzePlotHealth } = await import('../services/ai/ai-health.analyzer.js');
    const healthReport = await analyzePlotHealth(req.params.id);
    return successResponse(res, healthReport.data, 'วิเคราะห์สุขภาพพืชสำเร็จ');
  } catch (err) {
    next(err);
  }
});

// PUT /api/plots/:id
router.put('/:id', async (req, res, next) => {
  try {
    let finalArea = req.body.area;
    if (req.body.rai !== undefined || req.body.ngan !== undefined || req.body.sqWa !== undefined) {
      finalArea = parseThaiArea(req.body.rai, req.body.ngan, req.body.sqWa);
    }
    await updatePlot(req.params.id, req.userId, {
      ...req.body,
      area: finalArea !== undefined ? finalArea : req.body.area,
    });
    return successResponse(res, null, 'แก้ไขข้อมูลแปลงเรียบร้อย');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/plots/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deletePlot(req.params.id, req.userId);
    return successResponse(res, null, 'ลบแปลงเกษตรเรียบร้อย');
  } catch (err) {
    next(err);
  }
});

export default router;
