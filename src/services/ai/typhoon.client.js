import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.TYPHOON_API_KEY,
  baseURL: env.TYPHOON_BASE_URL,
});

export async function chatCompletion(messages, options = {}) {
  try {
    const response = await client.chat.completions.create({
      model: env.TYPHOON_MODEL,
      messages,
      max_tokens: options.maxTokens || env.TYPHOON_MAX_TOKENS,
      temperature: options.temperature || env.TYPHOON_TEMPERATURE,
    });

    return response.choices[0]?.message?.content || 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
  } catch (error) {
    logger.error('Typhoon LLM API Error:', error);
    throw new Error('ไม่สามารถเชื่อมต่อกับบริการ AI ครูสวน ได้ในขณะนี้: ' + (error.message || ''));
  }
}

export async function chatCompletionStream(messages, onChunk) {
  try {
    const stream = await client.chat.completions.create({
      model: env.TYPHOON_MODEL,
      messages,
      max_tokens: env.TYPHOON_MAX_TOKENS,
      temperature: env.TYPHOON_TEMPERATURE,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullContent += delta;
      if (delta) {
        onChunk(delta);
      }
    }
    return fullContent;
  } catch (error) {
    logger.error('Typhoon LLM Streaming Error:', error);
    throw error;
  }
}
