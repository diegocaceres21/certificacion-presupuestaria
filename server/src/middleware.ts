import { Request, Response, NextFunction } from 'express';
import { validateToken, Claims } from './auth';

// Extend Express Request to include auth claims
declare global {
  namespace Express {
    interface Request {
      claims?: Claims;
    }
  }
}

/**
 * Middleware that validates the JWT Bearer token and attaches claims to req.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  const token = header.slice(7);
  try {
    req.claims = validateToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware factory that restricts access to specific roles.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.claims || !roles.includes(req.claims.rol)) {
      res.status(403).json({ error: 'No tiene permisos para esta acción' });
      return;
    }
    next();
  };
}
