import type { APIRoute } from 'astro';
import prisma from '../../../lib/db';
import { getAuthUser } from '../../../lib/auth';

export const GET: APIRoute = async ({ params, cookies }) => {
  const auth = await getAuthUser(cookies);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.id!, userId: auth.userId },
    select: { id: true, name: true, diagram: true, code: true, html: true, settings: true, isPublic: true, createdAt: true, updatedAt: true },
  });

  if (!project) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return new Response(JSON.stringify(project), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const auth = await getAuthUser(cookies);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { name, diagram, code, html, settings } = await request.json();

  const result = await prisma.project.updateMany({
    where: { id: params.id!, userId: auth.userId },
    data: { name: name ?? 'Untitled', diagram, code, html, settings },
  });

  if (result.count === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  const updated = await prisma.project.findUnique({
    where: { id: params.id! },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return new Response(JSON.stringify(updated), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const auth = await getAuthUser(cookies);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { isPublic } = await request.json();

  const result = await prisma.project.updateMany({
    where: { id: params.id!, userId: auth.userId },
    data: { isPublic: Boolean(isPublic) },
  });

  if (result.count === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return new Response(JSON.stringify({ isPublic: Boolean(isPublic) }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const auth = await getAuthUser(cookies);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  await prisma.project.deleteMany({ where: { id: params.id!, userId: auth.userId } });

  return new Response(null, { status: 204 });
};
