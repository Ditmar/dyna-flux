import type { APIRoute } from 'astro';
import { compare } from 'bcryptjs';
import prisma from '../../../lib/db';
import { signToken, setAuthCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await compare(password, user.password))) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  const token = await signToken(user.id, user.email);
  setAuthCookie(cookies, token);

  return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
