import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import plotRoutes from './routes/plot.routes.js';
import taskRoutes from './routes/task.routes.js';
import journalRoutes from './routes/journal.routes.js';
import harvestRoutes from './routes/harvest.routes.js';
import marketRoutes from './routes/market.routes.js';
import chatRoutes from './routes/chat.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import { syncFromKnowledgeHub } from './services/knowledgeHubSync.service.js';
import notificationRoutes from './routes/notification.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import vapiRoutes from './routes/vapi.routes.js';
import storytellerRoutes from './routes/storyteller.routes.js';
import interviewProxyRoutes from './routes/interviewProxy.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'ครูสวน AI Backend API',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/plots', plotRoutes);
app.use('/api/plots/:plotId/journal', journalRoutes);
app.use('/api/plots/:plotId/harvests', harvestRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/storyteller', storytellerRoutes);
app.use('/api/interviews', interviewProxyRoutes);
app.use('/api/vapi', vapiRoutes); // เรียกโดย Vapi server-to-server ไม่ผ่าน JWT auth ของแอป

// Global Error Handler
app.use(errorHandler);

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const server = app.listen(env.PORT, () => {
  logger.info(`🌱 ครูสวน AI Backend API Server running on port ${env.PORT} [${env.NODE_ENV}]`);

  // ลองซิงค์คลังความรู้จาก Knowledge Hub (System 2) ตอนเริ่มระบบ — ถ้าเชื่อมไม่ได้ก็ข้ามไป ไม่ทำให้ระบบนี้ล่ม
  syncFromKnowledgeHub().catch((err) => {
    logger.warn('ข้ามการซิงค์คลังความรู้ตอนเริ่มระบบ (Knowledge Hub อาจยังไม่พร้อม):', err.message);
  });
});

// Keep event loop alive
setInterval(() => {}, 1000 * 60 * 60);

export default app;
