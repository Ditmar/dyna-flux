import type { APIRoute } from 'astro';
import prisma from '../../../lib/db';
import { getAuthUser } from '../../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  const auth = await getAuthUser(cookies);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  return new Response(JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' },
  });
};
