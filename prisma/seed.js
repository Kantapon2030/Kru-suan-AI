import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Knowledge Base
  const knowledgeData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../src/data/knowledge-seed.json'), 'utf-8')
  );

  await prisma.knowledgeEntry.deleteMany();
  for (const k of knowledgeData) {
    await prisma.knowledgeEntry.create({
      data: {
        crop: k.crop,
        topic: k.topic,
        subtopic: k.subtopic,
        stage: k.stage,
        region: k.region || null,
        condition: k.condition || null,
        question: k.question,
        answer: k.answer,
        source: k.source,
        tags: k.tags,
        isVerified: true,
      },
    });
  }
  console.log(`✅ Seeded ${knowledgeData.length} knowledge entries`);

  // 2. Create Demo Farmer User (Southern Thailand)
  const passwordHash = await bcrypt.hash('123456', 10);
  const demoUser = await prisma.user.upsert({
    where: { phone: '0812345678' },
    update: { 
      name: 'สมชาย เกษตรกรรุ่นใหม่',
      location: 'อ.พุนพิน จ.สุราษฎร์ธานี',
    },
    create: {
      name: 'สมชาย เกษตรกรรุ่นใหม่',
      phone: '0812345678',
      passwordHash,
      location: 'อ.พุนพิน จ.สุราษฎร์ธานี',
    },
  });
  console.log(`✅ Demo User created: ${demoUser.name} (Phone: 0812345678 / Pass: 123456 / Location: ${demoUser.location})`);

  // Clean legacy non-southern demo plots if present
  await prisma.plot.deleteMany({
    where: {
      userId: demoUser.id,
      cropName: { notIn: ['ทุเรียน', 'ยางพารา', 'ปาล์มน้ำมัน', 'มังคุด', 'ลองกอง', 'เงาะ', 'สะตอ', 'ขมิ้น'] },
    },
  });

  // 3. Create Sample Plot if not existing
  const existingPlot = await prisma.plot.findFirst({
    where: { userId: demoUser.id, name: 'แปลงทุเรียนหมอนทอง #01' },
  });

  if (!existingPlot) {
    const plantingDate = new Date();
    plantingDate.setDate(plantingDate.getDate() - 165); // 165 days ago

    const expectedHarvest = new Date(plantingDate);
    expectedHarvest.setDate(expectedHarvest.getDate() + 365);

    const plot = await prisma.plot.create({
      data: {
        userId: demoUser.id,
        name: 'แปลงทุเรียนหมอนทอง #01',
        cropName: 'ทุเรียน',
        cropEmoji: '🥭',
        area: 3200, // 2 ไร่
        location: 'แปลงริมเขา อ.พุนพิน จ.สุราษฎร์ธานี',
        soilType: 'ดินร่วนปนทรายระบายน้ำดี (ดินเขา)',
        waterSource: 'สระกักเก็บน้ำ/ระบบมินิสปริงเกอร์',
        plantingDate,
        expectedHarvestDate: expectedHarvest,
        status: 'ACTIVE',
        cropCycle: {
          create: {
            currentStage: 'VEGETATIVE',
            stageStartedAt: new Date(Date.now() - 45 * 86400000),
            progress: 45,
            stages: {
              create: [
                { stage: 'SEED', startedAt: plantingDate, completedAt: new Date(plantingDate.getTime() + 15 * 86400000) },
                { stage: 'SEEDLING', startedAt: new Date(plantingDate.getTime() + 15 * 86400000), completedAt: new Date(plantingDate.getTime() + 45 * 86400000) },
                { stage: 'VEGETATIVE', startedAt: new Date(plantingDate.getTime() + 45 * 86400000) },
              ],
            },
          },
        },
      },
    });

    // Create Tasks for Southern Durian Farm
    await prisma.task.createMany({
      data: [
        {
          plotId: plot.id,
          stage: 'VEGETATIVE',
          title: '💧 ให้น้ำแบบมินิสปริงเกอร์รอบทรงพุ่มแปลงทุเรียน',
          description: 'ให้น้ำช่วงเช้า 30-45 นาที เพื่อรักษาความชื้นใต้ทรงพุ่มและตรวจเช็กหัวสปริงเกอร์',
          instructions: JSON.stringify([
            { step: 1, text: 'ตรวจเช็กแรงดันและหัวมินิสปริงเกอร์รอบรัศมีทรงพุ่ม' },
            { step: 2, text: 'เปิดให้น้ำช่วงเช้า 30-45 นาที ให้ดินชุ่มลึกแต่ไม่แฉะขัง' },
          ]),
          emoji: '💧',
          estimatedTime: 20,
          status: 'PENDING',
          sortOrder: 1,
        },
        {
          plotId: plot.id,
          stage: 'VEGETATIVE',
          title: '🌿 ตรวจคอดินและราดเชื้อราไตรโคเดอร์มาป้องกันโรครากเน่าโคนเน่า',
          description: 'ส่องดูโคนต้นช่วงหน้าฝนชุกภาคใต้ ป้องกันเชื้อราไฟทอปธอร่าเข้าทำลายลำต้น',
          instructions: JSON.stringify([
            { step: 1, text: 'กวาดเศษใบไม้บริเวณโคนต้นออก และตรวจดูรอยแผลน้ำเยิ้มสีน้ำตาล' },
            { step: 2, text: 'ผสมเชื้อราปฏิปักษ์ไตรโคเดอร์มาราดรอบคอดินเพื่อสร้างเกราะป้องกัน' },
          ]),
          emoji: '🌿',
          estimatedTime: 25,
          status: 'PENDING',
          sortOrder: 2,
        },
      ],
    });

    // Create Farm Journal Entry
    await prisma.journalEntry.createMany({
      data: [
        {
          plotId: plot.id,
          type: 'STAGE_CHANGE',
          emoji: '🌱',
          title: 'ลงปลูกต้นพันธุ์ทุเรียนหมอนทองบนแปลงยกโคก',
          content: 'ลงกล้าเสียบยอด 50 ต้น ยกโคกสูง 50 ซม. ระบายน้ำฝนได้ดีเยี่ยมตามหลักเกษตรภาคใต้',
          createdAt: new Date(plantingDate.getTime() + 45 * 86400000),
        },
        {
          plotId: plot.id,
          type: 'OBSERVATION',
          emoji: '☀️',
          title: 'ทุเรียนแตกใบอ่อนชุดที่ 2 ใบเขียวเข้มสมบูรณ์',
          content: 'ยอดเดินดี ใบเพสลาดกางเต็มที่ ทรงพุ่มแผ่กว้าง ระบบรากแข็งแรงดีมาก',
          createdAt: new Date(),
        },
      ],
    });

    // Welcome Notification
    await prisma.notification.create({
      data: {
        userId: demoUser.id,
        type: 'GENERAL',
        title: '🌱 ยินดีต้อนรับสู่ ครูสวน AI!',
        body: 'คุณมี 2 ภารกิจที่ต้องทำในวันนี้สำหรับ แปลงทุเรียนหมอนทอง #01',
      },
    });

    console.log(`✅ Sample Plot created: ${plot.name}`);
  }

  console.log('🎉 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
