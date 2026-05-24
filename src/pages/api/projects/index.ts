import type { APIRoute } from 'astro';
import prisma from '../../../lib/db';
import { getAuthUser } from '../../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  const auth = await getAuthUser(cookies);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: auth.userId },
    select: { id: true, name: true, isPublic: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  return new Response(JSON.stringify(projects), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await getAuthUser(cookies);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { name, diagram, code, html, settings } = await request.json();

  const project = await prisma.project.create({
    data: { userId: auth.userId, name: name ?? 'Untitled', diagram, code, html, settings },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return new Response(JSON.stringify(project), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
