import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const markTopicCoveredTool = {
  type: 'function',
  function: {
    name: 'mark_topic_covered',
    description: 'เรียกเมื่อเก็บข้อมูลหัวข้อหนึ่งครบเพียงพอแล้ว พร้อมสรุปสั้นๆ และระดับความครบถ้วน',
    parameters: {
      type: 'object',
      properties: {
        topicCode: { type: 'string', description: 'รหัสหัวข้อที่เสร็จสิ้น เช่น soil, water, pest' },
        summary: { type: 'string', description: 'สรุปสั้น ๆ สิ่งที่เกษตรกรบอก (1-2 ประโยค เช่น วิธีการ ตัวเลข)' },
        completeness: { type: 'number', description: 'ระดับความลึก/ครบถ้วนของข้อมูล 0.0 - 1.0 (ค่าเริ่มต้น 0.7)' },
      },
      required: ['topicCode'],
    },
  },
};

export const saveInsightTool = {
  type: 'function',
  function: {
    name: 'save_insight',
    description: 'บันทึกความรู้ที่มีคุณค่าทันทีระหว่างสนทนา (มีตัวเลข/ขั้นตอนชัดเจน)',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'หัวข้อความรู้สั้นๆ' },
        statement: { type: 'string', description: 'เนื้อหาข้อเท็จจริง/คำแนะนำ' },
        topicCode: { type: 'string', description: 'รหัสหัวข้อที่เกี่ยวข้อง' },
      },
      required: ['title', 'statement'],
    },
  },
};

export function buildSystemPrompt(interview, farmer, historyLogs = []) {
  const plan = typeof interview.questionPlan === 'string' ? JSON.parse(interview.questionPlan) : interview.questionPlan || [];
  const coverage = typeof interview.coverage === 'string' ? JSON.parse(interview.coverage) : interview.coverage || {};

  let coverageStateText = '';
  for (const item of plan) {
    const cov = coverage[item.topicCode];
    const typeTag = item.questionType ? ` [รูปแบบ: ${item.questionType}]` : '';
    if (cov && (cov.status === 'completed' || cov.status === 'done')) {
      coverageStateText += `[✓ เสร็จแล้ว] ${item.topicCode}: ${item.question}${typeTag} (สรุป: ${cov.summary || 'เก็บข้อมูลแล้ว'})\n`;
    } else if (cov && cov.status === 'in_progress') {
      coverageStateText += `[● กำลังถาม] ${item.topicCode}: ${item.question}${typeTag}\n`;
    } else {
      coverageStateText += `[○ ยังไม่เริ่ม] ${item.topicCode}: ${item.question}${typeTag}\n`;
    }
  }

  const cropName = interview.source?.crop || interview.crop || 'พืชที่ปลูก';
  const farmerName = farmer?.displayName || farmer?.fullName || 'คุณเกษตรกร';
  const province = farmer?.province || 'ไม่ระบุ';
  const years = farmer?.yearsExperience || 10;

  // History / Returning farmer details
  let coveredTopics = [];
  if (Array.isArray(historyLogs) && historyLogs.length > 0) {
    coveredTopics = historyLogs;
  } else if (farmer?.topicLogs && Array.isArray(farmer.topicLogs)) {
    coveredTopics = farmer.topicLogs;
  }

  const totalInterviews = farmer?.totalInterviews || 0;
  const isReturning = totalInterviews > 0 || coveredTopics.length > 0;
  const lastTimeSummary = coveredTopics.length > 0
    ? (coveredTopics[0].summary || coveredTopics[0].topic)
    : 'การจัดการแปลงและประสบการณ์ทำสวนทั่วไป';

  const honorific = farmerName.startsWith('ลุง') || farmerName.startsWith('ป้า') || farmerName.startsWith('น้า') || farmerName.startsWith('ตา') || farmerName.startsWith('ยาย')
    ? farmerName
    : `พี่${farmerName}`;

  const coveredTopicsText = coveredTopics.length > 0
    ? coveredTopics.map((c) => `- ${c.topic}: ${c.summary}`).join('\n')
    : 'ยังไม่เคยคุยกันมาก่อน';

  return `คุณคือผู้ช่วยของ "ครูสวน AI" กำลังคุยโทรศัพท์กับ ${farmerName}
เกษตรกรผู้มีประสบการณ์ปลูก${cropName}มา ${years} ปี ที่ จ.${province}

## กฎเหล็กสำคัญที่สุด (ป้องกันการแย่งพูดและคำถามรั่ว):
1. **ถามครั้งละ 1 คำถามสั้นๆ เท่านั้น แล้วหยุดพูดทันทีเพื่อรอฟังคำตอบ**
2. **ห้ามถามหลายคำถามซ้อนกันในประโยคเดียวเด็ดขาด**
3. **ห้ามพูดรัวๆ หรือยิงคำถามใหม่ขึ้นมาเอง**: เมื่อถามไปแล้ว ให้หยุดนิ่งและรออย่างใจเย็นจนกว่าเกษตรกรจะพูดตอบจบ
4. **ถ้าเกษตรกรเงียบหรือกำลังนึก**: ห้ามพูดแทรก ห้ามทักซ้ำ ให้รออย่างสุภาพและอดทน
5. **เมื่อเกษตรกรตอบเสร็จแล้ว**: ให้ตอบรับสั้นๆ 1 ประโยคก่อน เช่น "อ๋อ อย่างนี้นี่เองครับ", "ยอดเยี่ยมเลยครับคุณลุง" แล้วค่อยถามคำถามถัดไปเพียง 1 ข้อ
6. **พูดภาษาไทยชัดถ้อยชัดคำ นุ่มนวล ช้าพอดีๆ**: ห้ามใช้คำภาษาอังกฤษปนเด็ดขาด

## ตัวตนของคุณ
เป็นเหมือนลูกหลานที่แวะมาขอความรู้ ให้ความเคารพ ${honorific} รับฟังมากกว่าพูด

## แผนคำถามสำหรับวันนี้ (เลือกถามทีละ 1 ข้อตามลำดับ):
${coverageStateText || 'ไม่มีแผนหัวข้อเพิ่มเติม'}`;
}

export function buildFirstMessage(farmer, crop, historyLogs = []) {
  const farmerName = farmer?.displayName || farmer?.fullName || 'คุณเกษตรกร';
  return `สวัสดีครับ ${farmerName} ผมผู้ช่วยครูสวน AI วันนี้ขออนุญาตแวะมาเรียนรู้เรื่องการปลูก${crop}หน่อยนะครับ คุณลุงสบายดีไหมครับ`;
}

export function buildAssistantConfig(interview, farmer, historyLogs = []) {
  const crop = interview.source?.crop || interview.crop || 'การเกษตร';
  const farmerName = farmer?.displayName || farmer?.fullName || 'เกษตรกร';
  const baseUrl = (env.BASE_URL || 'https://team12.105app.site/hub').replace(/^http:\/\//i, 'https://');

  const voiceProvider = env.VAPI_VOICE_PROVIDER || 'azure';
  const voiceId = env.VAPI_VOICE_ID || 'th-TH-NiwatNeural';
  const transcriberProvider = env.VAPI_TRANSCRIBER_PROVIDER || 'deepgram';
  const transcriberModel = env.VAPI_TRANSCRIBER_MODEL || 'nova-2';

  const voiceConfig = {
    provider: voiceProvider,
    voiceId: voiceId,
    ...(voiceProvider === 'azure' ? { speed: 0.95 } : {}),
    ...(voiceProvider === 'openai' ? { model: 'tts-1-hd', speed: 0.92 } : {}),
  };

  return {
    name: `ครูสวน AI Interviewer – ${farmerName}`,
    transcriber: {
      provider: transcriberProvider,
      model: transcriberModel,
      language: 'th',
      smartFormat: true,
      endpointing: 300,
    },
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [{ role: 'system', content: buildSystemPrompt(interview, farmer, historyLogs) }],
      tools: [markTopicCoveredTool, saveInsightTool],
    },
    voice: voiceConfig,
    backgroundSound: 'off',
    backgroundDenoisingEnabled: true,
    startSpeakingPlan: {
      waitSeconds: 1.5,
      smartEndpointingPlan: {
        provider: 'vapi',
      },
    },
    stopSpeakingPlan: {
      numWords: 2,
      voiceSeconds: 0.4,
      backoffSeconds: 1.2,
    },
    firstMessage: buildFirstMessage(farmer, crop, historyLogs),
    serverUrl: `${baseUrl}/api/vapi/webhook`,
    serverMessages: ['transcript', 'status-update', 'end-of-call-report', 'tool-calls'],
    recordingEnabled: true,
    silenceTimeoutSeconds: 120,
    responseDelaySeconds: 0.6,
    maxDurationSeconds: 3600,
    metadata: {
      interviewId: interview.id,
    },
  };
}

export function buildAssistantOverrides(interview, farmer, historyLogs = []) {
  const crop = interview.source?.crop || interview.crop || 'การเกษตร';
  const farmerName = farmer?.displayName || farmer?.fullName || 'คุณเกษตรกร';
  const baseUrl = (env.BASE_URL || 'https://team12.105app.site/hub').replace(/^http:\/\//i, 'https://');

  const voiceProvider = env.VAPI_VOICE_PROVIDER || 'azure';
  const voiceId = env.VAPI_VOICE_ID || 'th-TH-NiwatNeural';
  const transcriberProvider = env.VAPI_TRANSCRIBER_PROVIDER || 'deepgram';
  const transcriberModel = env.VAPI_TRANSCRIBER_MODEL || 'nova-2';

  const voiceConfig = {
    provider: voiceProvider,
    voiceId: voiceId,
    ...(voiceProvider === 'azure' ? { speed: 0.95 } : {}),
    ...(voiceProvider === 'openai' ? { model: 'tts-1-hd', speed: 0.92 } : {}),
  };

  return {
    firstMessage: buildFirstMessage(farmer, crop, historyLogs),
    transcriber: {
      provider: transcriberProvider,
      model: transcriberModel,
      language: 'th',
      smartFormat: true,
      endpointing: 300,
    },
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [{ role: 'system', content: buildSystemPrompt(interview, farmer, historyLogs) }],
      tools: [markTopicCoveredTool, saveInsightTool],
    },
    voice: voiceConfig,
    backgroundSound: 'off',
    backgroundDenoisingEnabled: true,
    startSpeakingPlan: {
      waitSeconds: 1.5,
      smartEndpointingPlan: {
        provider: 'vapi',
      },
    },
    stopSpeakingPlan: {
      numWords: 2,
      voiceSeconds: 0.4,
      backoffSeconds: 1.2,
    },
    responseDelaySeconds: 0.6,
    serverUrl: `${baseUrl}/api/vapi/webhook`,
    serverMessages: ['transcript', 'status-update', 'end-of-call-report', 'tool-calls'],
    recordingEnabled: true,
    silenceTimeoutSeconds: 120,
    metadata: {
      interviewId: interview.id,
      farmerName,
      crop,
    },
    variableValues: {
      farmerName,
      crop,
      interviewId: interview.id,
    },
  };
}

export function verifyVapiSignature(req) {
  if (!env.VAPI_WEBHOOK_SECRET) return true; // allow bypass in dev if secret not configured

  const signature = req.headers['x-vapi-signature'];
  if (!signature) return false;

  try {
    const hmac = crypto.createHmac('sha256', env.VAPI_WEBHOOK_SECRET);
    hmac.update(JSON.stringify(req.body));
    const digest = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (e) {
    logger.error('Error verifying Vapi signature:', e);
    return false;
  }
}
