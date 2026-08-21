import { env } from '../config/env.js';
import { errorResponse } from '../utils/apiResponse.js';

export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || apiKey !== env.SYSTEM1_KB_API_KEY) {
    return errorResponse(res, 'Unauthorized: Invalid or missing X-API-Key', 401);
  }

  next();
}
