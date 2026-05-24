import 'dotenv/config';
import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dyna-flux-dev-secret'
);
const COOKIE = 'dyna-flux-auth';
const ONE_WEEK = 60 * 60 * 24 * 7;

export async function signToken(userId: string, email: string) {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { userId: string; email: string };
}

export async function getAuthUser(cookies: AstroCookies) {
  const token = cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function setAuthCookie(cookies: AstroCookies, token: string) {
  cookies.set(COOKIE, token, { httpOnly: true, maxAge: ONE_WEEK, sameSite: 'lax', path: '/' });
}

export function clearAuthCookie(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}
