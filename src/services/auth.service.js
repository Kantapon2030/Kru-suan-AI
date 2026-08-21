import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const prisma = new PrismaClient();

export async function registerUser({ name, phone, password, location }) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    const error = new Error('เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      phone,
      passwordHash,
      location,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      profileImage: true,
      location: true,
      createdAt: true,
    },
  });

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { user, token };
}

export async function loginUser({ phone, password }) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    const error = new Error('เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง');
    error.statusCode = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const error = new Error('เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง');
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const { passwordHash, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

export async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      profileImage: true,
      location: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    const error = new Error('ไม่พบข้อมูลผู้ใช้');
    error.statusCode = 404;
    throw error;
  }

  // Calculate statistics
  const plotsCount = await prisma.plot.count({
    where: { userId, status: { in: ['ACTIVE', 'HARVESTED'] } },
  });

  const userPlots = await prisma.plot.findMany({
    where: { userId },
    select: { id: true },
  });
  const plotIds = userPlots.map((p) => p.id);

  const completedTasksCount = await prisma.task.count({
    where: {
      plotId: { in: plotIds },
      status: 'COMPLETED',
    },
  });

  const harvestsCount = await prisma.harvest.count({
    where: {
      plotId: { in: plotIds },
    },
  });

  const daysActive = Math.max(
    1,
    Math.ceil((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
  );

  return {
    ...user,
    stats: {
      plotsCount,
      completedTasksCount,
      harvestsCount,
      daysActive,
    },
  };
}

export async function updateUserProfile(userId, data) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      profileImage: true,
      location: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return user;
}
