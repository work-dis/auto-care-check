import jwt from 'jsonwebtoken';

const JWT_EXPIRES_IN = '7d';
const DEVELOPMENT_SECRET = 'autopulse-dev-secret-change-in-production';

function getJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return DEVELOPMENT_SECRET;
}

export interface JwtPayload {
  userId: string;
  username: string;
  sessionVersion: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  if (
    typeof payload === 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.username !== 'string' ||
    typeof payload.sessionVersion !== 'number'
  ) {
    throw new Error('Invalid JWT payload');
  }
  return payload as JwtPayload;
}
