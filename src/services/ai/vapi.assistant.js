import { env } from '../../config/env.js';

// สร้าง config ผู้ช่วยเสียงแบบ inline ให้ frontend ส่งตรงให้ Vapi Web SDK (vapi.start(assistant))
// ฝัง userId/conversationId เป็น query string บน url ของ custom-llm และ serverUrl ของ webhook
// เพื่อไม่ต้องพึ่งพฤติกรรม metadata-forwarding ของ Vapi ซึ่งอาจต่างกันไปตามเวอร์ชัน SDK
export function buildAdvisorAssistantConfig({ user, conversationId, plotId }) {
  const qs = new URLSearchParams({
    userId: user.id,
    conversationId,
    ...(plotId ? { plotId } : {}),
  }).toString();

  const baseUrl = (env.BASE_URL || 'https://team12.105app.site').replace(/^http:\/\//i, 'https://');

  const voiceProvider = env.VAPI_VOICE_PROVIDER || 'openai';
  const voiceId = env.VAPI_ADVISOR_VOICE_ID || 'alloy';
  const voiceModel = env.VAPI_VOICE_MODEL || (voiceProvider === 'openai' ? 'tts-1-hd' : undefined);
  const transcriberProvider = env.VAPI_TRANSCRIBER_PROVIDER || 'deepgram';
  const transcriberModel = env.VAPI_TRANSCRIBER_MODEL || 'nova-2';

  const voiceConfig = {
    provider: voiceProvider,
    voiceId: voiceId,
    ...(voiceModel ? { model: voiceModel } : {}),
  };

  return {
    firstMessage: `สวัสดีครับคุณ${user.name || ''} ครูสวน AI ยินดีให้คำปรึกษาเรื่องการเกษตรครับ วันนี้อยากถามเรื่องอะไรครับ`,
    transcriber: {
      provider: transcriberProvider,
      model: transcriberModel,
      language: 'th',
    },
    model: {
      provider: 'custom-llm',
      url: `${baseUrl}/api/vapi/chat/completions?${qs}`,
      model: env.TYPHOON_MODEL || 'typhoon-v2.5-30b-a3b-instruct',
    },
    voice: voiceConfig,
    backgroundSound: 'off',
    startSpeakingPlan: {
      waitSeconds: 0.4,
      smartEndpointingPlan: {
        provider: 'vapi',
      },
    },
    stopSpeakingPlan: {
      numWords: 1,
      voiceSeconds: 0.2,
      backoffSeconds: 0.8,
    },
    responseDelaySeconds: 0.4,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 3600,
    serverUrl: `${baseUrl}/api/vapi/webhook?${qs}`,
    serverMessages: ['transcript', 'status-update', 'end-of-call-report'],
    metadata: { userId: user.id, conversationId, plotId: plotId || null },
    variableValues: {
      userName: user.name || 'เกษตรกร',
      conversationId,
    },
  };
}
