import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const PORT = env.PORT || 3001;

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const server = app.listen(PORT, () => {
  logger.info(`====================================================`);
  logger.info(`🌱 ครูสวน AI — Knowledge Acquisition Platform (System 2)`);
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📱 Interviewer Dashboard: http://localhost:${PORT}/interviewer_dashboard/code.html`);
  logger.info(`🎙️ Live Call Visualizer: http://localhost:${PORT}/live_call_with_gemini_visualizer/code.html`);
  logger.info(`📊 Admin Dashboard:       http://localhost:${PORT}/admin_dashboard/code.html`);
  logger.info(`🧠 Knowledge Review:     http://localhost:${PORT}/knowledge_review/code.html`);
  logger.info(`🔄 System 1 Sync API:    http://localhost:${PORT}/kb/v1/entries`);
  logger.info(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Please terminate existing process or use another port.`);
  } else {
    logger.error('Server error:', err);
  }
});

// Heartbeat keep-alive to keep the process permanently alive
setInterval(() => {
  // no-op heartbeat
}, 1000 * 30);
