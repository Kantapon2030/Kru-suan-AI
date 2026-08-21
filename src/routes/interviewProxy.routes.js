import { Router } from 'express';
import { env } from '../config/env.js';

const router = Router();
const KB_URL = env.KNOWLEDGE_HUB_URL || 'http://localhost:3001';

// Forward requests under /api/interviews to Knowledge Hub (System 2)
router.all('*', async (req, res, next) => {
  try {
    const targetUrl = new URL(`/api/interviews${req.path}`, KB_URL);
    Object.entries(req.query).forEach(([k, v]) => targetUrl.searchParams.set(k, v));

    // Handle SSE streams
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      const response = await fetch(targetUrl.toString(), {
        headers: { 'Accept': 'text/event-stream' }
      });
      res.writeHead(response.status, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch (e) {} finally {
            res.end();
          }
        };
        return pump();
      }
      return res.end();
    }

    const headers = { ...req.headers };
    delete headers.host;

    const fetchOptions = {
      method: req.method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl.toString(), fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    res.status(response.status);
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (error) {
    console.error('Error proxying interview request to Knowledge Hub:', error.message);
    res.status(502).json({
      success: false,
      error: 'ไม่สามารถเชื่อมต่อระบบสัมภาษณ์ (Knowledge Hub) ได้',
    });
  }
});

export default router;
