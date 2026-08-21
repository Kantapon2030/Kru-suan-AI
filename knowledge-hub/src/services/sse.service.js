import { logger } from '../utils/logger.js';

// Map of interviewId -> Set of response objects
const subscribers = new Map();

export function sseSubscribe(interviewId, res) {
  if (!subscribers.has(interviewId)) {
    subscribers.set(interviewId, new Set());
  }

  const clients = subscribers.get(interviewId);
  clients.add(res);

  logger.info(`SSE Client connected to interview ${interviewId} (Total: ${clients.size})`);

  // Clean up on disconnect
  res.on('close', () => {
    clients.delete(res);
    if (clients.size === 0) {
      subscribers.delete(interviewId);
    }
    logger.info(`SSE Client disconnected from interview ${interviewId}`);
  });
}

export function sseBroadcast(interviewId, eventType, data) {
  const clients = subscribers.get(interviewId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch (err) {
      logger.error('Failed to send SSE payload:', err);
    }
  }
}
