import http from 'http';
import app from '../src/app.js';
import { PrismaClient } from '@prisma/client';
import { buildSystemPrompt, buildAssistantConfig, buildFirstMessage } from '../src/services/vapi.service.js';
import { generateQuestionPlan } from '../src/services/ai/question-planner.service.js';

const prisma = new PrismaClient();
const PORT = 3098;

async function runTests() {
  console.log('🧪 Starting Farmer Memory & Persona (Part 3) E2E Test Suite...\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`📡 Test Server running on port ${PORT}`);

  const baseUrl = `http://localhost:${PORT}`;
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const testPhone = `089999${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    // 1. Check lookup on non-existing farmer
    console.log('\n--- 1. Testing Lookup on Brand New Farmer ---');
    const lookup1Res = await fetch(`${baseUrl}/api/farmers/lookup?phone=${testPhone}`);
    const lookup1Json = await lookup1Res.json();
    assert(lookup1Res.status === 200, 'GET /api/farmers/lookup returns 200');
    assert(lookup1Json.data?.exists === false, 'New phone is not found in database');

    // 2. Create 1st Interview for Farmer
    console.log('\n--- 2. Creating 1st Interview for Farmer ---');
    const create1Res = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        farmerName: 'ลุงประเสริฐ สวนทุเรียนโบราณ',
        area: 'สุราษฎร์ธานี',
        experience: 28,
        expertise: 'การยกร่องดินและการเปิดตาดอกทุเรียน',
        crop: 'ทุเรียน',
        topics: ['การเตรียมดินและการจัดการแปลง', 'การให้น้ำและการจัดการความชื้น']
      })
    });
    const create1Json = await create1Res.json();
    assert(create1Res.status === 201, 'POST /api/interviews returns 201');
    const interview1Id = create1Json.data?.id;
    const farmerId = create1Json.data?.farmerId;
    assert(!!interview1Id, `1st Interview created with ID: ${interview1Id}`);
    assert(!!farmerId, `Farmer created with ID: ${farmerId}`);

    const plan1 = JSON.parse(create1Json.data?.questionPlan || '[]');
    assert(plan1.length > 0, `Generated ${plan1.length} questions for 1st round`);
    assert(plan1.some(p => p.questionType), 'Questions have questionType attribute assigned');

    // 3. Start & Simulate 1st Interview Turn
    console.log('\n--- 3. Simulating 1st Interview Turns ---');
    const start1Res = await fetch(`${baseUrl}/api/interviews/${interview1Id}/start`, { method: 'POST' });
    assert(start1Res.status === 200, 'POST /api/interviews/:id/start returns 200');

    const turn1Res = await fetch(`${baseUrl}/api/interviews/${interview1Id}/simulate-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'การเตรียมดินต้องยกร่องสูง 50 เซนติเมตร ผสมโดโลไมท์ 500 กรัมต่อหลุมเพื่อปรับสภาพความเป็นกรดด่างให้อยู่ที่ 6.0'
      })
    });
    const turn1Json = await turn1Res.json();
    assert(turn1Res.status === 200, 'Simulated 1st turn successfully');
    assert(!!turn1Json.data?.aiSegment?.text, 'AI generated conversational response');

    // 4. Complete 1st Interview & Check Topic Logs
    console.log('\n--- 4. Completing 1st Interview & Checking Topic Logs ---');
    const end1Res = await fetch(`${baseUrl}/api/interviews/${interview1Id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costUsd: 0.04 })
    });
    assert(end1Res.status === 200, 'POST /api/interviews/:id/end completed');

    // Wait a brief moment for database sync
    await new Promise((r) => setTimeout(r, 800));

    const topicLogs1 = await prisma.farmerTopicLog.findMany({
      where: { farmerId }
    });
    assert(topicLogs1.length > 0, `FarmerTopicLog has ${topicLogs1.length} records saved`);
    assert(!!topicLogs1[0].summary, `TopicLog contains summary: "${topicLogs1[0]?.summary?.slice(0, 40)}..."`);

    const farmerAfter1 = await prisma.farmer.findUnique({ where: { id: farmerId } });
    assert(farmerAfter1.totalInterviews >= 1, `farmer.totalInterviews incremented to ${farmerAfter1.totalInterviews}`);
    assert(!!farmerAfter1.lastInterviewAt, 'farmer.lastInterviewAt was updated');

    // 5. Lookup Returning Farmer
    console.log('\n--- 5. Testing Lookup on Returning Farmer ---');
    const lookup2Res = await fetch(`${baseUrl}/api/farmers/lookup?phone=${testPhone}`);
    const lookup2Json = await lookup2Res.json();
    assert(lookup2Res.status === 200, 'GET /api/farmers/lookup returns 200 for returning farmer');
    assert(lookup2Json.data?.exists === true, 'Existing farmer detected');
    assert(lookup2Json.data?.isReturning === true, 'isReturning flag is true');
    assert(lookup2Json.data?.farmer?.totalInterviews >= 1, `Lookup returns totalInterviews: ${lookup2Json.data?.farmer?.totalInterviews}`);
    assert(lookup2Json.data?.farmer?.coveredTopics?.length > 0, `Lookup returns ${lookup2Json.data?.farmer?.coveredTopics?.length} covered topics`);

    // 6. Create 2nd Interview with same Farmer -> Question Plan Deduplication
    console.log('\n--- 6. Creating 2nd Interview with Farmer (Testing Memory & Topic Deduplication) ---');
    const create2Res = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        farmerName: 'ลุงประเสริฐ สวนทุเรียนโบราณ',
        area: 'สุราษฎร์ธานี',
        experience: 28,
        expertise: 'การยกร่องดินและการเปิดตาดอกทุเรียน',
        crop: 'ทุเรียน',
        topics: ['การเตรียมดินและการจัดการแปลง', 'โรคและแมลงศัตรูพืช', 'การตัดแต่งกิ่งและการดูแลทรงพุ่ม']
      })
    });
    const create2Json = await create2Res.json();
    assert(create2Res.status === 201, 'POST /api/interviews for 2nd round returns 201');
    assert(create2Json.data?.farmerId === farmerId, 'Reused the exact same Farmer record (cross-session identity preserved)');

    const plan2 = JSON.parse(create2Json.data?.questionPlan || '[]');
    console.log('  📋 2nd Round Question Plan Topics:', plan2.map(p => `${p.topic} (${p.questionType})`).join(', '));
    assert(plan2.length > 0, '2nd round question plan created');

    // 7. Check Assistant Persona, Prompt & First Message
    console.log('\n--- 7. Checking Assistant Persona & Prompt Generation ---');
    const interview2 = await prisma.interview.findUnique({
      where: { id: create2Json.data.id },
      include: { farmer: { include: { topicLogs: true } }, source: true }
    });

    const systemPrompt2 = buildSystemPrompt(interview2, interview2.farmer, interview2.farmer?.topicLogs || []);
    assert(systemPrompt2.includes('นี่คือการคุยครั้งที่'), 'System prompt mentions interview round');
    assert(systemPrompt2.includes('คุณไม่ใช่นักข่าวที่มาสัมภาษณ์ให้จบทีเดียว'), 'System prompt enforces polite conversational younger visitor persona');
    assert(systemPrompt2.includes('หัวข้อที่เคยคุยแล้ว (ห้ามถามซ้ำ)'), 'System prompt contains explicit covered topics exclusion section');
    assert(systemPrompt2.includes('หลังฟังเรื่องเล่าแล้ว ต้องเจาะตัวเลข'), 'System prompt enforces quantitative probing rule');

    const firstMsg2 = buildFirstMessage(interview2.farmer, 'ทุเรียน', interview2.farmer?.topicLogs || []);
    console.log(`  💬 2nd Round First Message: "${firstMsg2}"`);
    assert(firstMsg2.includes('ไม่เจอกันเลย') || firstMsg2.includes('ครั้งก่อน'), 'First message warmly references prior meeting');

    const assistantConfig = buildAssistantConfig(interview2, interview2.farmer, interview2.farmer?.topicLogs || []);
    assert(assistantConfig.model.tools.some(t => t.function.name === 'mark_topic_covered'), 'Assistant config includes mark_topic_covered tool');

    console.log(`\n========================================`);
    console.log(`🎉 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('💥 Test suite crashed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
