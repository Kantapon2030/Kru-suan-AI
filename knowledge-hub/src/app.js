import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import meRoutes from './routes/me.routes.js';
import taxonomyRoutes from './routes/taxonomy.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import vapiRoutes from './routes/vapi.routes.js';
import adminRoutes from './routes/admin.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import syncRoutes from './routes/sync.routes.js';
import sourceRoutes from './routes/source.routes.js';
import farmerRoutes from './routes/farmer.routes.js';
import storytellerRoutes from './routes/storyteller.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/taxonomy', taxonomyRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/storyteller', storytellerRoutes);
app.use('/api/vapi', vapiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/review', knowledgeRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/farmers', farmerRoutes);

// System 1 Sync Routes
app.use('/kb/v1', syncRoutes);

// Serve static UI directories
app.use(express.static(rootDir));

// Friendly UI Redirects
app.get('/', (req, res) => {
  res.redirect('/interviewer_dashboard/code.html');
});

app.get('/storyteller', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/storyteller/index.html${query}`);
});

app.get('/storyteller/live', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/storyteller/live.html${query}`);
});

app.get('/storyteller/summary', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/storyteller/summary.html${query}`);
});

app.get('/admin', (req, res) => {
  res.redirect('/admin_dashboard/code.html');
});

app.get('/create-interview', (req, res) => {
  res.redirect('/create_interview/code.html');
});

app.get('/live-call', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/live_call_with_gemini_visualizer/code.html${query}`);
});

app.get('/review', (req, res) => {
  res.redirect('/knowledge_review/code.html');
});

app.get('/knowledge-review', (req, res) => {
  res.redirect('/knowledge_review/code.html');
});

// Error handler
app.use(errorHandler);

export default app;
