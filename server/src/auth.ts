import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface Claims {
  sub: string;
  rol: string;
  nombre: string;
}

const SALT_ROUNDS = 10;

function getSecret(): string {
  return process.env.JWT_SECRET || 'default_secret_change_me';
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hashed: string): boolean {
  return bcrypt.compareSync(password, hashed);
}

export function createToken(userId: string, rol: string, nombre: string): string {
  const payload: Claims & { exp: number } = {
    sub: userId,
    rol,
    nombre,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h
  };
  return jwt.sign(payload, getSecret());
}

export function validateToken(token: string): Claims {
  const decoded = jwt.verify(token, getSecret()) as Claims;
  return decoded;
}
