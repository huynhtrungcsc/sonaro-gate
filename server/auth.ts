import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'sonaro-gate-secret-change-in-production';
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
