import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { registerUser, loginUser, getUserProfile } from '../services/auth.service.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร'),
    phone: z.string().min(9, 'เบอร์โทรศัพท์ไม่ถูกต้อง'),
    password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
    location: z.string().optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    phone: z.string().min(1, 'กรอกเบอร์โทรศัพท์'),
    password: z.string().min(1, 'กรอกรหัสผ่าน'),
  }),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    return successResponse(res, result, 'ลงทะเบียนสำเร็จ', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    return successResponse(res, result, 'เข้าสู่ระบบสำเร็จ');
  } catch (err) {
    next(err);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await getUserProfile(req.userId);
    return successResponse(res, user);
  } catch (err) {
    next(err);
  }
});

export default router;
