import app from '../src/app.js';
import http from 'http';

const PORT = 3099;

async function runTests() {
  console.log('🚀 Starting Knowledge Hub (System 2) E2E Test Suite...\n');

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

  try {
    // 1. Taxonomy API
    console.log('\n--- 1. Testing Taxonomy API ---');
    const taxRes = await fetch(`${baseUrl}/api/taxonomy`);
    const taxJson = await taxRes.json();
    assert(taxRes.status === 200, 'GET /api/taxonomy returns 200');
    assert(taxJson.data?.crops?.length > 0, 'Returns list of crops');
    assert(taxJson.data?.topics?.length > 0, 'Returns list of topics');

    // 2. Admin & Me Stats
    console.log('\n--- 2. Testing Stats APIs ---');
    const adminStatsRes = await fetch(`${baseUrl}/api/admin/stats`);
    const adminStatsJson = await adminStatsRes.json();
    assert(adminStatsRes.status === 200, 'GET /api/admin/stats returns 200');
    assert(typeof adminStatsJson.data?.sources === 'number', 'Admin stats contains sources count');

    const meStatsRes = await fetch(`${baseUrl}/api/me/stats`);
    const meStatsJson = await meStatsRes.json();
    assert(meStatsRes.status === 200, 'GET /api/me/stats returns 200');
    assert(typeof meStatsJson.data?.interviews === 'number', 'Me stats contains interviews count');

    // 3. Create Interview
    console.log('\n--- 3. Testing Interview Creation ---');
    const createRes = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmerName: 'ลุงประเสริฐ สวนปาล์ม',
        area: 'สุราษฎร์ธานี',
        experience: 20,
        expertise: 'การตัดแต่งทางใบและการใส่ปุ๋ยปาล์มน้ำมัน',
        crop: 'ปาล์มน้ำมัน',
        topics: ['การใส่ปุ๋ย', 'การดูแล']
      })
    });
    const createJson = await createRes.json();
    assert(createRes.status === 201, 'POST /api/interviews returns 201');
    const interviewId = createJson.data?.id;
    assert(!!interviewId, `Interview created with ID: ${interviewId}`);
    assert(!!createJson.data?.questionPlan, 'Question plan was generated');

    // 4. Start Interview
    console.log('\n--- 4. Testing Start Interview ---');
    const startRes = await fetch(`${baseUrl}/api/interviews/${interviewId}/start`, { method: 'POST' });
    const startJson = await startRes.json();
    assert(startRes.status === 200, 'POST /api/interviews/:id/start returns 200');
    assert(startJson.data?.status === 'in_progress', 'Interview status set to in_progress');
    assert(!!startJson.data?.assistantConfig, 'Vapi assistant configuration returned');

    // 5. Simulate Turns
    console.log('\n--- 5. Testing Conversational Turns ---');
    const turnRes = await fetch(`${baseUrl}/api/interviews/${interviewId}/simulate-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'การใส่ปุ๋ยปาล์มน้ำมันควรใส่สูตร 14-7-35 ต้นละ 2 กิโลกรัม ทุก 3 เดือน โรยรอบทรงพุ่ม ห้ามใส่ชิดโคนต้นเด็ดขาดเพราะจะทำให้รากไหม้'
      })
    });
    const turnJson = await turnRes.json();
    assert(turnRes.status === 200, 'POST /api/interviews/:id/simulate-turn returns 200');
    assert(!!turnJson.data?.aiSegment, 'AI generated a response turn');

    // 6. End Call & Trigger Extraction Pipeline
    console.log('\n--- 6. Testing End Call & Extraction Pipeline ---');
    const endRes = await fetch(`${baseUrl}/api/interviews/${interviewId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costUsd: 0.08 })
    });
    assert(endRes.status === 200, 'POST /api/interviews/:id/end returns 200');

    // Wait a brief moment for async extraction to process
    console.log('  ⏳ Waiting 3 seconds for extraction pipeline to complete...');
    await new Promise((r) => setTimeout(r, 3000));

    // 7. Review Queue & Candidates
    console.log('\n--- 7. Testing Review Queue ---');
    const queueRes = await fetch(`${baseUrl}/api/review/queue`);
    const queueJson = await queueRes.json();
    assert(queueRes.status === 200, 'GET /api/review/queue returns 200');
    assert(queueJson.data?.items?.length > 0, `Found ${queueJson.data?.items?.length} items in review queue`);

    const candidateToApprove = queueJson.data.items[0];
    assert(!!candidateToApprove.id, `Candidate found: "${candidateToApprove.title}"`);
    assert(typeof candidateToApprove.confidence === 'number', `Confidence score: ${candidateToApprove.confidence}`);

    // 8. Candidate Approval
    console.log('\n--- 8. Testing Candidate Approval ---');
    const approveRes = await fetch(`${baseUrl}/api/knowledge/${candidateToApprove.id}/approve`, {
      method: 'POST'
    });
    const approveJson = await approveRes.json();
    assert(approveRes.status === 200, 'POST /api/knowledge/:id/approve returns 200');
    assert(approveJson.data?.status === 'approved', 'Candidate marked as approved');

    // 9. System 1 Sync API (/kb/v1/entries)
    console.log('\n--- 9. Testing System 1 Sync API (/kb/v1/entries) ---');
    // Test without key -> 401
    const unauthRes = await fetch(`${baseUrl}/kb/v1/entries`);
    assert(unauthRes.status === 401, 'Unauthorized request to /kb/v1/entries returns 401');

    // Test with correct key
    const syncRes = await fetch(`${baseUrl}/kb/v1/entries?isVerified=true`, {
      headers: { 'X-API-Key': 'krusuan_sync_secure_key_2026' }
    });
    const syncJson = await syncRes.json();
    assert(syncRes.status === 200, 'Authorized request with X-API-Key returns 200');
    assert(Array.isArray(syncJson.entries), 'Returns entries array');
    assert(syncJson.entries.length > 0, `Found ${syncJson.entries.length} approved entries ready for System 1`);

    const sampleEntry = syncJson.entries[0];
    assert(!!sampleEntry.question && !!sampleEntry.answer, 'Entry has question and answer fields 1:1 with System 1');
    assert(!!sampleEntry.crop, `Entry crop: ${sampleEntry.crop}`);
    assert(!!sampleEntry.source, `Entry source: ${sampleEntry.source}`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    console.log(`\n========================================`);
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
    if (failed > 0) process.exit(1);
  }
}

runTests();
