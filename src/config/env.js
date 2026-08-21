import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'krusuan_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  TYPHOON_API_KEY: process.env.TYPHOON_API_KEY || 'sk-zNqiSPVXV8du6jHQwYlLMXVV8wSzKdqJUc1gUbamxj36pGJg',
  TYPHOON_BASE_URL: process.env.TYPHOON_BASE_URL || 'https://api.opentyphoon.ai/v1',
  TYPHOON_MODEL: process.env.TYPHOON_MODEL || 'typhoon-v2.5-30b-a3b-instruct',
  TYPHOON_MAX_TOKENS: parseInt(process.env.TYPHOON_MAX_TOKENS || '1024', 10),
  TYPHOON_TEMPERATURE: parseFloat(process.env.TYPHOON_TEMPERATURE || '0.7'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),

  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY || '',
  VAPI_ASSISTANT_ID: process.env.VAPI_ASSISTANT_ID || '45070c56-2475-46e2-9e75-3f2cb605d96f',
  VAPI_VOICE_PROVIDER: process.env.VAPI_VOICE_PROVIDER || 'openai',
  VAPI_ADVISOR_VOICE_ID: process.env.VAPI_ADVISOR_VOICE_ID || 'alloy',
  VAPI_VOICE_MODEL: process.env.VAPI_VOICE_MODEL || 'tts-1-hd',
  VAPI_TRANSCRIBER_PROVIDER: process.env.VAPI_TRANSCRIBER_PROVIDER || 'deepgram',
  VAPI_TRANSCRIBER_MODEL: process.env.VAPI_TRANSCRIBER_MODEL || 'nova-2',

  // Knowledge Hub (System 2) sync
  KNOWLEDGE_HUB_URL: process.env.KNOWLEDGE_HUB_URL || 'http://localhost:3001',
  SYSTEM1_KB_API_KEY: process.env.SYSTEM1_KB_API_KEY || 'krusuan_sync_secure_key_2026',
};
