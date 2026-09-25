import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    logger.error({ err: error, method: req.method, path: req.path }, '[HTTP] Error after headers sent');
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: z.flattenError(error).fieldErrors,
    });
    return;
  }

  // JSON malformado ou corpo grande demais, vindos do express.json()
  if (isBodyParserError(error)) {
    res.status(error.status).json({ error: 'BAD_REQUEST', message: 'Corpo da requisição inválido' });
    return;
  }

  logger.error({ err: error, method: req.method, path: req.path }, '[HTTP] Unhandled error');

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor',
  });
}

function isBodyParserError(error: unknown): error is { status: 400 | 413; type: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'status' in error &&
    (error.status === 400 || error.status === 413)
  );
}