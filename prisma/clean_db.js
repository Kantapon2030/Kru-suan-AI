import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up mock / demo plots, journals, tasks, and notifications...');

  await prisma.notification.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.task.deleteMany();
  await prisma.stageLog.deleteMany();
  await prisma.cropCycle.deleteMany();
  await prisma.product.deleteMany();
  await prisma.harvest.deleteMany();
  await prisma.plot.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.voiceSession.deleteMany();

  console.log('✨ Cleaned up plots, tasks, and mock user activities!');
  console.log(`🧠 Knowledge Entries preserved: ${await prisma.knowledgeEntry.count()}`);
  console.log(`👤 Users count: ${await prisma.user.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
