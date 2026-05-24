import type { APIRoute } from 'astro';
import { hash } from 'bcryptjs';
import prisma from '../../../lib/db';
import { signToken, setAuthCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password, name } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400 });
  }
  if (password.length < 6) {
    return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 409 });
  }

  const hashed = await hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashed, name: name || null },
    select: { id: true, email: true, name: true },
  });

  const token = await signToken(user.id, user.email);
  setAuthCookie(cookies, token);

  return new Response(JSON.stringify({ user }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
