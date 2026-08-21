import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getUserNotifications(userId, unreadOnly = false) {
  const where = { userId };
  if (unreadOnly) where.isRead = false;

  return await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
}

export async function markAsRead(notificationId, userId) {
  return await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId) {
  return await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount: count };
}
