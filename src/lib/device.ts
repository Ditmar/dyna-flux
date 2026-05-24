import type { AstroCookies } from 'astro';
import { randomUUID } from 'crypto';

const COOKIE = 'dyna-flux-device';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getOrCreateDeviceId(cookies: AstroCookies): string {
  let id = cookies.get(COOKIE)?.value;
  if (!id) {
    id = randomUUID();
    cookies.set(COOKIE, id, {
      httpOnly: true,
      maxAge: ONE_YEAR,
      sameSite: 'lax',
      path: '/',
    });
  }
  return id;
}
