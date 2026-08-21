import { logger } from '../utils/logger.js';
import { errorResponse } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, next) {
  logger.error('Unhandled Server Error:', err);

  if (err.name === 'ZodError') {
    return errorResponse(
      res,
      'ข้อมูลที่ส่งมาไม่ถูกต้อง',
      422,
      err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
    );
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'เกิดข้อผิดพลาดภายในระบบเซิร์ฟเวอร์';

  return errorResponse(res, message, statusCode);
}
