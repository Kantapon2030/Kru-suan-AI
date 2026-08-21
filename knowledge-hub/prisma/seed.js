import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Knowledge Hub Database...');

  // 1. Clean existing data
  await prisma.knowledgeCandidate.deleteMany();
  await prisma.transcriptSegment.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.source.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      phone: '0811111111',
      passwordHash,
      role: 'admin',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNEp7pAcJ0hHvqT_PJYaWBIBfAazNojkVijqObb3TnJm83cktttn8YXJaNCY_TvuPoeOSqmzwLMi2hEUe6P36IttFOSrwTohaiAhS6TZxcBISMqGuzPWlTdcA9t1MCreh_5bNECEtnSf82L-a8-qVh7978Rzi0RW-p9G8datfSG4iEMFktjcyISPk2Cqvign7KVPUVBvvgsXZMESqj_dB4EGH_J3YNN1b5bQ4tgt0tlEY4GETaqN3JRg',
    },
  });

  const interviewer = await prisma.user.create({
    data: {
      name: 'สมศักดิ์ สัมภาษณ์',
      phone: '0822222222',
      passwordHash,
      role: 'interviewer',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCoBoRu6QWsEwO5icu65YVvGFTi38MS41MhusGaEVlargIeF7aqIMqHiNDM63xKRZBhnQ1jDBc7imO8qVs92lNmV1Y5jlAmAlWzaGZXBwH56ua0F6qiN-hv8yiRJFq6UAqhz59_PYsJedkNf3l1-VwRlHbZZb-lZdArEU3IcUlrhaAQ83ppbVqqa_C1OwMNHwlOWEnEU2D_xLkGpFKs2JyUAEIEXmMNm7BNgp2NcD0mcnWAxnJ3j9YaFA',
    },
  });

  // 3. Create Farmers (Southern Thailand)
  const farmer1 = await prisma.farmer.create({
    data: {
      fullName: 'นายสมชาย ดีพร้อม',
      displayName: 'ลุงสมชาย',
      phone: '0891234567',
      province: 'สุราษฎร์ธานี',
      region: 'ภาคใต้',
      yearsExperience: 25,
      expertiseNote: 'เชี่ยวชาญการทำทุเรียนคุณภาพภาคใต้และการจัดการสวนปาล์มน้ำมัน',
      cropTags: JSON.stringify(['ทุเรียน', 'ปาล์มน้ำมัน']),
      consentGranted: true,
    },
  });

  const farmer2 = await prisma.farmer.create({
    data: {
      fullName: 'นางประไพ สวนงาม',
      displayName: 'ป้าศรี',
      phone: '0876543210',
      province: 'นครศรีธรรมราช',
      region: 'ภาคใต้',
      yearsExperience: 18,
      expertiseNote: 'การปลูกมังคุดคุณภาพส่งออกและการดูแลส้มโอทับทิมสยามอินทรีย์',
      cropTags: JSON.stringify(['มังคุด', 'ส้มโอทับทิมสยาม']),
      consentGranted: true,
    },
  });

  const farmer3 = await prisma.farmer.create({
    data: {
      fullName: 'นายบุญมี รักษ์ป่า',
      displayName: 'ลุงบุญมี',
      phone: '0865551234',
      province: 'สงขลา',
      region: 'ภาคใต้',
      yearsExperience: 30,
      expertiseNote: 'การกรีดยางพาราหน้ายางสมบูรณ์และจัดการโรครากเน่า',
      cropTags: JSON.stringify(['ยางพารา', 'ปาล์มน้ำมัน']),
      consentGranted: true,
    },
  });

  // 4. Create Sources & Interviews
  // Source 1: Interview with ลุงสมชาย (ทุเรียนภาคใต้)
  const source1 = await prisma.source.create({
    data: {
      type: 'LIVE_CALL',
      title: 'สัมภาษณ์ ลุงสมชาย - การกักน้ำเปิดตาดอกทุเรียนภาคใต้',
      status: 'IN_REVIEW',
      durationSec: 2700, // 45 min
      licenseBasis: 'farmer_consent',
      crop: 'ทุเรียน',
      region: 'ภาคใต้',
    },
  });

  const interview1 = await prisma.interview.create({
    data: {
      sourceId: source1.id,
      farmerId: farmer1.id,
      interviewerId: interviewer.id,
      status: 'completed',
      startedAt: new Date(Date.now() - 3600 * 1000 * 2),
      endedAt: new Date(Date.now() - 3600 * 1000 * 1.25),
      durationSec: 2700,
      questionPlan: JSON.stringify([
        { topicCode: 'soil', question: 'การเตรียมดินและยกโคกทุเรียนรับมือฝนชุกภาคใต้ทำอย่างไร', priority: 1 },
        { topicCode: 'water', question: 'เทคนิคการกักน้ำเปิดตาดอกทุเรียนช่วงมรสุมฝนตกบ่อย', priority: 2 },
        { topicCode: 'disease', question: 'การป้องกันโรครากเน่าโคนเน่า (ไฟทอปธอร่า) ในสวนทุเรียนภาคใต้', priority: 3 },
      ]),
      coverage: JSON.stringify({
        soil: { status: 'completed', summary: 'ยกโคกสูง 50-80 ซม. ผสมโดโลไมต์ปรับดินกรด ระบายน้ำดี' },
        water: { status: 'completed', summary: 'กวาดโคนเตียน งดน้ำ 7-10 วันจนใบสลดแล้วโชยน้ำเบาๆ' },
        disease: { status: 'completed', summary: 'ตัดแต่งกิ่งโปร่ง ราดเชื้อราไตรโคเดอร์มารอบคอดิน' },
      }),
      costUsd: 0.12,
    },
  });

  // Transcript Segments for Source 1
  await prisma.transcriptSegment.createMany({
    data: [
      {
        sourceId: source1.id,
        seq: 1,
        speaker: 'ai',
        startMs: 0,
        endMs: 6500,
        text: 'สวัสดีครับลุงสมชาย วันนี้ผมขออนุญาตสอบถามเรื่องเทคนิคการเปิดตาดอกทุเรียนในภาคใต้นะครับ ในช่วงฝนตกบ่อยมีวิธีจัดการอย่างไรครับ',
        confidence: 0.98,
      },
      {
        sourceId: source1.id,
        seq: 2,
        speaker: 'farmer',
        startMs: 7000,
        endMs: 25000,
        text: 'ทุเรียนภาคใต้เปิดตาดอกยากเพราะฝนชุก ต้องกวาดโคนใต้ทรงพุ่มให้เตียนเพื่อระบายความชื้นผิวดินออกเร็วที่สุด กักน้ำให้ดินแห้ง 7-10 วันจนใบสลดแล้วโชยน้ำเบาๆ เพื่อกระตุ้นตาดอก หากฝนตกให้ฉีดพ่นปุ๋ยทางใบสูตรสะสมตาดอกเพื่อคุมไนโตรเจนไม่ให้แตกใบอ่อนแทนดอก',
        confidence: 0.95,
      },
      {
        sourceId: source1.id,
        seq: 3,
        speaker: 'ai',
        startMs: 26000,
        endMs: 31000,
        text: 'แล้วสำหรับการยกโคกเตรียมดินปลูกทุเรียนในภาคใต้ สำคัญอย่างไรครับลุงสมชาย',
        confidence: 0.97,
      },
      {
        sourceId: source1.id,
        seq: 4,
        speaker: 'farmer',
        startMs: 32000,
        endMs: 48000,
        text: 'การยกโคกในภาคใต้สำคัญมากเพราะฝนแปดแดดสี่ ต้องยกโคกสูง 50-80 เซนติเมตร กว้าง 2-3 เมตร ผสมปุ๋ยคอกหมักและโดโลไมต์ปรับสภาพดินกรด น้ำจะได้ไม่ท่วมขังโคนต้น ป้องกันโรครากเน่าโคนเน่าได้ดี',
        confidence: 0.96,
      },
    ],
  });

  // Knowledge Candidates for Source 1
  const cand1 = await prisma.knowledgeCandidate.create({
    data: {
      sourceId: source1.id,
      title: 'การกักน้ำเปิดตาดอกทุเรียนภาคใต้',
      crop: 'ทุเรียน',
      topic: 'การจัดการน้ำ',
      subtopic: 'การเปิดตาดอกช่วงฝนชุก',
      stage: 'FLOWERING',
      region: 'ภาคใต้',
      condition: 'ช่วงฝนตกชุก',
      question: 'ทุเรียนภาคใต้คุมน้ำเปิดตาดอกยากเพราะฝนตกบ่อย มีเทคนิคอย่างไร',
      answer: 'ต้องกวาดโคนใต้ทรงพุ่มให้เตียนเพื่อระบายความชื้นผิวดินออกเร็วที่สุด กักน้ำให้ดินแห้ง 7-10 วันจนใบสลดแล้วโชยน้ำเบาๆ เพื่อกระตุ้นตาดอก หากฝนตกหนักให้ฉีดพ่นปุ๋ยทางใบสูตรสะสมตาดอก (0-42-56 หรือ 0-52-34) เพื่อคุมไนโตรเจนไม่ให้แตกใบอ่อนแทนดอก',
      provenanceText: 'สัมภาษณ์เกษตรกร ลุงสมชาย (สุราษฎร์ธานี)',
      tags: JSON.stringify(['ทุเรียน', 'เปิดตาดอก', 'กักน้ำ', 'ภาคใต้', 'ปุ๋ยทางใบ']),
      quote: 'ทุเรียนภาคใต้เปิดตาดอกยากเพราะฝนชุก ต้องกวาดโคนใต้ทรงพุ่มให้เตียนเพื่อระบายความชื้นผิวดินออกเร็วที่สุด กักน้ำให้ดินแห้ง 7-10 วันจนใบสลดแล้วโชยน้ำเบาๆ',
      confidence: 0.88,
      riskLevel: 'normal',
      status: 'pending_review',
      extractionModel: 'typhoon-v2.5-30b-a3b-instruct',
    },
  });

  // Source 2: Interview with ป้าศรี (มังคุดภาคใต้)
  const source2 = await prisma.source.create({
    data: {
      type: 'LIVE_CALL',
      title: 'สัมภาษณ์ ป้าศรี - คุณภาพมังคุดส่งออกและป้องกันเนื้อแก้ว',
      status: 'IN_REVIEW',
      durationSec: 1920, // 32 min
      crop: 'มังคุด',
      region: 'ภาคใต้',
    },
  });

  const interview2 = await prisma.interview.create({
    data: {
      sourceId: source2.id,
      farmerId: farmer2.id,
      interviewerId: interviewer.id,
      status: 'completed',
      durationSec: 1920,
      questionPlan: JSON.stringify([
        { topicCode: 'quality', question: 'วิธีป้องกันมังคุดเนื้อแก้วยางไหลช่วงฝนตกชุกภาคใต้', priority: 1 },
      ]),
      coverage: JSON.stringify({
        quality: { status: 'completed', summary: 'ใส่แคลเซียมโบรอน เสริมความแข็งแรงเซลล์ผล และทำร่องระบายน้ำรอบทรงพุ่ม' },
      }),
    },
  });

  const cand2 = await prisma.knowledgeCandidate.create({
    data: {
      sourceId: source2.id,
      title: 'การป้องกันมังคุดเนื้อแก้วและยางไหล',
      crop: 'มังคุด',
      topic: 'คุณภาพผลผลิต',
      subtopic: 'ป้องกันเนื้อแก้วช่วงฝนตก',
      stage: 'FRUIT',
      region: 'ภาคใต้',
      condition: 'ช่วงฝนตกชุกก่อนเก็บเกี่ยว',
      question: 'มังคุดภาคใต้เป็นเนื้อแก้ว ยางไหลเปื้อนเปลือกช่วงฝนตก ป้องกันอย่างไร',
      answer: 'เนื้อแก้วเกิดจากมังคุดได้รับน้ำมากเกินไปช่วงใกล้สุก ทำให้เซลล์ดูดน้ำเร็วเกินจนแตก วิธีป้องกันคือใส่ปุ๋ยแคลเซียม-โบรอนช่วงพัฒนาการผลเพื่อเพิ่มความแข็งแรงของผนังเซลล์ และทำทางระบายน้ำรอบทรงพุ่มไม่ให้น้ำขังช่วงฝนตก',
      provenanceText: 'สัมภาษณ์เกษตรกร ป้าศรี (นครศรีธรรมราช)',
      tags: JSON.stringify(['มังคุด', 'เนื้อแก้ว', 'ยางไหล', 'แคลเซียมโบรอน', 'ภาคใต้']),
      quote: 'วิธีป้องกันคือใส่ปุ๋ยแคลเซียม-โบรอนช่วงพัฒนาการผลเพื่อเพิ่มความแข็งแรงของผนังเซลล์ และทำทางระบายน้ำรอบทรงพุ่ม',
      confidence: 0.85,
      riskLevel: 'normal',
      status: 'pending_review',
      extractionModel: 'typhoon-v2.5-30b-a3b-instruct',
    },
  });

  // Source 3: Interview with ลุงบุญมี (ยางพารา)
  const source3 = await prisma.source.create({
    data: {
      type: 'LIVE_CALL',
      title: 'สัมภาษณ์ ลุงบุญมี - โรครากเน่าในยางพารา',
      status: 'IN_REVIEW',
      durationSec: 2100,
      crop: 'ยางพารา',
      region: 'ภาคใต้',
    },
  });

  const cand3 = await prisma.knowledgeCandidate.create({
    data: {
      sourceId: source3.id,
      title: 'โรครากเน่าในยางพารา',
      crop: 'ยางพารา',
      topic: 'โรคพืช',
      subtopic: 'โรครากขาวและรากเน่า',
      stage: 'VEGETATIVE',
      region: 'ภาคใต้',
      condition: 'ช่วงฝนตกชุก',
      question: 'ช่วงฝนตกชุกป้องกันโรครากเน่าในสวนยางพาราอย่างไร',
      answer: 'ช่วงฝนตกชุกต้องขุดร่องระบายน้ำรอบแปลงไม่ให้น้ำท่วมขังบริเวณโคนต้น หากพบต้นที่เป็นโรคให้ขุดคูกักกันรอบต้นและใช้เชื้อราไตรโคเดอร์มาร่วมกับปูนขาวปรับสภาพดิน หลีกเลี่ยงการใช้สารเคมีเข้มข้นสัมผัสเปลือกโดยตรง',
      provenanceText: 'สัมภาษณ์เกษตรกร ลุงบุญมี (สงขลา)',
      tags: JSON.stringify(['ยางพารา', 'โรคพืช', 'รากเน่า', 'ภาคใต้']),
      quote: 'ช่วงฝนตกชุกต้องขุดร่องระบายน้ำรอบแปลงไม่ให้น้ำท่วมขังบริเวณโคนต้น',
      confidence: 0.91,
      riskLevel: 'chemical',
      status: 'pending_review',
      extractionModel: 'typhoon-v2.5-30b-a3b-instruct',
    },
  });

  // Source 4: Already Approved Knowledge
  const source4 = await prisma.source.create({
    data: {
      type: 'LIVE_CALL',
      title: 'สัมภาษณ์ ลุงสมชาย - การยกโคกปลูกทุเรียนรับน้ำฝนภาคใต้',
      status: 'COMPLETED',
      durationSec: 1800,
      crop: 'ทุเรียน',
      region: 'ภาคใต้',
    },
  });

  await prisma.knowledgeCandidate.create({
    data: {
      sourceId: source4.id,
      title: 'การเตรียมดินยกโคกปลูกทุเรียนภาคใต้',
      crop: 'ทุเรียน',
      topic: 'การปลูก',
      subtopic: 'การเตรียมดิน',
      stage: 'PLANTING',
      region: 'ภาคใต้',
      condition: 'รับมือฤดูมรสุม',
      question: 'การยกโคกปลูกทุเรียนในภาคใต้ควรมีขนาดความสูงและความกว้างเท่าใด',
      answer: 'ควรยกโคกสูงประมาณ 50-80 เซนติเมตร เส้นผ่านศูนย์กลางโคก 2-3 เมตร ใช้ดินร่วนผสมปุ๋ยหมักอินทรีย์และโดโลไมต์ ช่วยให้ระบายน้ำได้ดี ป้องกันน้ำขังโคนต้นและโรครากเน่าโคนเน่า',
      provenanceText: 'สัมภาษณ์เกษตรกร ลุงสมชาย (สุราษฎร์ธานี)',
      tags: JSON.stringify(['ทุเรียน', 'การปลูก', 'ยกโคก', 'เตรียมดิน', 'ภาคใต้']),
      quote: 'ต้องยกโคกสูงประมาณ 50-80 เซนติเมตร กว้าง 2-3 เมตร ผสมปุ๋ยคอกหมักกับหน้าดิน',
      confidence: 0.95,
      riskLevel: 'normal',
      status: 'approved',
      reviewedById: admin.id,
      reviewedAt: new Date(),
      extractionModel: 'typhoon-v2.5-30b-a3b-instruct',
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
