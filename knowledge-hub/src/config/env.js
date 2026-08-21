import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3001',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./krusuan-kb.db',
  JWT_SECRET: process.env.JWT_SECRET || 'krusuan_kb_secret_jwt_key_2026',
  
  // Typhoon LLM
  TYPHOON_API_KEY: process.env.TYPHOON_API_KEY || '',
  TYPHOON_BASE_URL: process.env.TYPHOON_BASE_URL || 'https://api.opentyphoon.ai/v1',
  TYPHOON_MODEL: process.env.TYPHOON_MODEL || 'typhoon-v2.5-30b-a3b-instruct',
  
  // Vapi Integration
  VAPI_API_KEY: process.env.VAPI_API_KEY || '',
  VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY || '',
  VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET || '',
  VAPI_ASSISTANT_ID: process.env.VAPI_ASSISTANT_ID || '',
  VAPI_VOICE_PROVIDER: process.env.VAPI_VOICE_PROVIDER || 'azure',
  VAPI_VOICE_ID: process.env.VAPI_VOICE_ID || 'th-TH-NiwatNeural',
  VAPI_VOICE_MODEL: process.env.VAPI_VOICE_MODEL || '',
  VAPI_TRANSCRIBER_PROVIDER: process.env.VAPI_TRANSCRIBER_PROVIDER || 'deepgram',
  VAPI_TRANSCRIBER_MODEL: process.env.VAPI_TRANSCRIBER_MODEL || 'nova-2',

  // System 1 Sync
  SYSTEM1_KB_API_KEY: process.env.SYSTEM1_KB_API_KEY || 'krusuan_sync_secure_key_2026',
};
