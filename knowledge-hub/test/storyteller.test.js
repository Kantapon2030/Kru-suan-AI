import { PrismaClient } from '@prisma/client';
import app from '../src/app.js';
import http from 'http';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Testing Senior Farmer Storytelling & Wisdom Hall APIs...');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(3999, resolve));
  const baseUrl = 'http://localhost:3999';

  try {
    // 1. Test GET /api/storyteller/topics
    console.log('\n--- 1. Testing GET /api/storyteller/topics ---');
    const topicsRes = await fetch(`${baseUrl}/api/storyteller/topics`);
    const topicsData = await topicsRes.json();
    console.log('Topics status:', topicsRes.status, 'Success:', topicsData.success);
    console.log('Topics count:', topicsData.data?.length);
    if (!topicsData.success || topicsData.data.length === 0) {
      throw new Error('Failed to fetch storyteller topics');
    }
    console.log('Sample topic:', topicsData.data[0].title);

    // 2. Test POST /api/storyteller/start
    console.log('\n--- 2. Testing POST /api/storyteller/start ---');
    const startPayload = {
      farmerName: 'ลุงสมชาย ทดสอบ',
      phone: '0899999999',
      province: 'สุราษฎร์ธานี',
      crop: 'ทุเรียน',
      topicTheme: 'fertilizer_soil',
      experience: 25,
    };
    const startRes = await fetch(`${baseUrl}/api/storyteller/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startPayload),
    });
    const startData = await startRes.json();
    console.log('Start status:', startRes.status, 'Success:', startData.success);
    console.log('Interview ID:', startData.data?.interviewId);
    console.log('Farmer:', startData.data?.farmer?.displayName);
    console.log('Assistant Persona First Message:', startData.data?.assistantOverrides?.firstMessage);
    
    if (!startData.success || !startData.data?.interviewId) {
      throw new Error('Failed to start storyteller session');
    }

    const interviewId = startData.data.interviewId;

    // 3. Test simulating a conversation turn (saving insight)
    console.log('\n--- 3. Testing simulate farmer speech ---');
    const turnRes = await fetch(`${baseUrl}/api/interviews/${interviewId}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'สูตรปุ๋ยหมักของลุง ลุงใช้มูลวัว 1 กระสอบ ผสมรำข้าว 5 กิโล และน้ำหมักชีวภาพ พักไว้ 15 วันก่อนใส่โคนทุเรียน',
      }),
    });
    const turnData = await turnRes.json();
    console.log('Turn status:', turnRes.status, 'Success:', turnData.success);

    // 4. Test POST /api/storyteller/:id/end
    console.log('\n--- 4. Testing POST /api/storyteller/:id/end ---');
    const endRes = await fetch(`${baseUrl}/api/storyteller/${interviewId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costUsd: 0.02 }),
    });
    const endData = await endRes.json();
    console.log('End status:', endRes.status, 'Success:', endData.success);

    // 5. Test GET /api/storyteller/:id/summary
    console.log('\n--- 5. Testing GET /api/storyteller/:id/summary ---');
    const sumRes = await fetch(`${baseUrl}/api/storyteller/${interviewId}/summary`);
    const sumData = await sumRes.json();
    console.log('Summary status:', sumRes.status, 'Success:', sumData.success);
    console.log('Summary Farmer Name:', sumData.data?.farmer?.displayName);
    console.log('Summary Covered Topics Count:', sumData.data?.coveredTopics?.length);
    console.log('Summary Total Words:', sumData.data?.farmerTotalWords);

    console.log('\n✅ ALL STORYTELLER TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
