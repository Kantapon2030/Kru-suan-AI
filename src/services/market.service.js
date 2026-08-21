import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getMarketProducts(status = 'READY') {
  const where = {};
  if (status) where.status = status;

  return await prisma.product.findMany({
    where,
    include: {
      harvest: {
        include: {
          plot: {
            select: { name: true, location: true, cropEmoji: true, user: { select: { name: true, phone: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateProductStatus(productId, { status, expectedPrice, notes }) {
  return await prisma.product.update({
    where: { id: productId },
    data: {
      ...(status && { status }),
      ...(expectedPrice !== undefined && { expectedPrice: parseFloat(expectedPrice) }),
      ...(notes && { notes }),
    },
  });
}
