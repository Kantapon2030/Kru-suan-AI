import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export const typhoonClient = new OpenAI({
  apiKey: env.TYPHOON_API_KEY,
  baseURL: env.TYPHOON_BASE_URL,
});

export async function chatCompletion(messages, options = {}) {
  try {
    const response = await typhoonClient.chat.completions.create({
      model: env.TYPHOON_MODEL,
      messages,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature !== undefined ? options.temperature : 0.4,
      response_format: options.responseFormat,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('Typhoon LLM API Error:', error);
    throw new Error('ไม่สามารถเชื่อมต่อกับ Typhoon AI ได้: ' + (error.message || ''));
  }
}

export async function chatCompletionStream(messages, options = {}) {
  try {
    const stream = await typhoonClient.chat.completions.create({
      model: env.TYPHOON_MODEL,
      messages,
      tools: options.tools,
      tool_choice: options.toolChoice,
      temperature: options.temperature !== undefined ? options.temperature : 0.4,
      max_tokens: options.maxTokens || 2048,
      stream: true,
    });

    return stream;
  } catch (error) {
    logger.error('Typhoon LLM Streaming Error:', error);
    throw error;
  }
}
