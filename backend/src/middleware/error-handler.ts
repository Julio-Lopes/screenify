import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err: error, method: req.method, path: req.path }, '[HTTP] Unhandled error');

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor',
  });
}