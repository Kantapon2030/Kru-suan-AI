import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return errorResponse(res, 'กรุณาระบุเบอร์โทรศัพท์และรหัสผ่าน', 400);
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return errorResponse(res, 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง', 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return errorResponse(res, 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง', 401);
    }

    const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });

    return successResponse(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    }, 'เข้าสู่ระบบสำเร็จ');
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, phone, password, role = 'interviewer' } = req.body;
    if (!name || !phone || !password) {
      return errorResponse(res, 'กรุณากรอกข้อมูลให้ครบถ้วน', 400);
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return errorResponse(res, 'เบอร์โทรศัพท์นี้ลงทะเบียนแล้ว', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, phone, passwordHash, role },
    });

    const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });

    return successResponse(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    }, 'ลงทะเบียนสำเร็จ', 201);
  } catch (error) {
    next(error);
  }
});

export default router;
