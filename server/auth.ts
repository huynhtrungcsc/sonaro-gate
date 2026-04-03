import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// JWT_SECRET must be set via environment variable in production.
// If not set (dev/test), generate a strong random secret per process so that
// tokens from one run are NOT valid after a restart.  In production TLS mode
// this will cause a startup warning — set JWT_SECRET in .env to suppress it.
function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  const tlsEnabled  = !!(process.env.TLS_CERT_FILE && process.env.TLS_KEY_FILE);
  if (isProduction && tlsEnabled) {
    console.error(
      '[Auth] CRITICAL: JWT_SECRET env var is not set in production TLS mode.\n' +
      '[Auth]          All sessions will be invalidated on every restart.\n' +
      '[Auth]          Add JWT_SECRET=<32+ random bytes hex> to .env immediately.'
    );
  }
  // Per-process random secret — safe for dev, non-persistent for prod restarts
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET  = resolveJwtSecret();
const JWT_EXPIRES = '24h';

export function signToken(payload: object, expiresIn: string = JWT_EXPIRES): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function checkPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function signMfaChallenge(userId: string): string {
  return signToken({ sub: userId, purpose: 'mfa_challenge' }, '5m');
}

export function verifyMfaChallenge(token: string): string | null {
  try {
    const decoded: any = verifyToken(token);
    if (decoded.purpose !== 'mfa_challenge') return null;
    return decoded.sub as string;
  } catch {
    return null;
  }
}
