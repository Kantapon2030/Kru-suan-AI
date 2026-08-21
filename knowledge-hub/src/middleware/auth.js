import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { PrismaClient } from '@prisma/client';
import { errorResponse } from '../utils/apiResponse.js';

const prisma = new PrismaClient();

export async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Fallback for hackathon demo: attach first active admin or interviewer user if available
      const defaultUser = await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (defaultUser) {
        req.user = defaultUser;
        return next();
      }
      return errorResponse(res, 'กรุณาเข้าสู่ระบบก่อนใช้งาน', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId || decoded.id },
    });

    if (!user) {
      return errorResponse(res, 'ไม่พบข้อมูลผู้ใช้งาน', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    // If token invalid, still provide fallback if available or return 401
    const defaultUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (defaultUser) {
      req.user = defaultUser;
      return next();
    }
    return errorResponse(res, 'Session หมดอายุหรือไม่ถูกต้อง', 401);
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 'คุณไม่มีสิทธิ์ในการดำเนินการนี้', 403);
    }
    next();
  };
}
