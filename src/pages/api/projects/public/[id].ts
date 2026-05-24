import type { APIRoute } from 'astro';
import prisma from '../../../../lib/db';

export const GET: APIRoute = async ({ params }) => {
  const project = await prisma.project.findFirst({
    where: { id: params.id!, isPublic: true },
    select: { id: true, name: true, diagram: true, code: true, html: true, settings: true, createdAt: true, updatedAt: true },
  });

  if (!project) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return new Response(JSON.stringify(project), {
    headers: { 'Content-Type': 'application/json' },
  });
};
