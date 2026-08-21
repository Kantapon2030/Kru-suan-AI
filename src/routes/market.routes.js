import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getMarketProducts, updateProductStatus } from '../services/market.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const products = await getMarketProducts(req.query.status);
    return successResponse(res, products);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updated = await updateProductStatus(req.params.id, req.body);
    return successResponse(res, updated, 'อัพเดทสถานะสินค้าเรียบร้อย');
  } catch (err) {
    next(err);
  }
});

export default router;
