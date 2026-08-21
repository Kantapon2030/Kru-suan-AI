import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { errorResponse } from '../utils/apiResponse.js';

export function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'กรุณาเข้าสู่ระบบก่อนใช้งาน', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return errorResponse(res, 'Session หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่', 401);
  }
}
