import { HttpError, sendJson } from '../utils/http.js';
import { logger } from '../utils/logger.js';

export function handleError(res, err) {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    sendJson(res, err.status, { error: err.message, details: err.details });
    return;
  }
  logger.error(err?.stack || err);
  sendJson(res, 500, { error: 'Something went wrong on the server' });
}
