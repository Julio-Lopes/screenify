import type { NextFunction, Request, Response } from 'express';
import { findUserBySessionToken } from '../services/user.service.js';
import { AppError } from '../utils/app-error.js';

const BEARER_PREFIX = 'Bearer ';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith(BEARER_PREFIX)) {
    throw AppError.unauthorized();
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  const user = token.length > 0 ? await findUserBySessionToken(token) : null;

  if (!user) {
    throw AppError.unauthorized('Sessão inválida');
  }

  req.user = user;
  next();
}

export function getAuthUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user;
}