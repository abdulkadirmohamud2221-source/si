import { Router, type RequestHandler } from 'express';
import { Prisma, PublicationStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../security';
import { asyncRoute, httpError } from '../utils';
import { validateCmsMediaContent } from '../cmsMediaValidation';
import { validateDynamicPageSections } from '../cmsSections';

type CmsDatabase = Pick<typeof prisma, 'cmsEntry' | 'cmsRevision' | 'auditLog'>;

export const createCmsRouter = (
  database: CmsDatabase = prisma,
  authenticate: RequestHandler = requireAuth,
  authorize: typeof requireRole = requireRole
) => {
const router = Router();
const staffRoles = [Role.OWNER, Role.SUPER_ADMIN, Role.ADMIN] as const;
const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const entrySchema = z.object({
  type: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  slug: slugSchema,
  title: z.string().trim().min(1).max(240),
  summary: z.string().max(10000).optional(),
  content: z.record(z.string(), z.unknown()),
});

const recordRevision = async (entry: {
  id: string; type: string; slug: string; title: string; summary: string | null;
  content: Prisma.JsonValue; status: PublicationStatus; deletedAt: Date | null; publishedAt: Date | null;
}, authorId: string) => {
  const revisionNumber = await database.cmsRevision.count({ where: { entryId: entry.id } }) + 1;
  await database.cmsRevision.create({
    data: {
      entryId: entry.id,
      revisionNumber,
      type: entry.type,
      slug: entry.slug,
      title: entry.title,
      summary: entry.summary,
      content: entry.content as Prisma.InputJsonValue,
      status: entry.status,
      deletedAt: entry.deletedAt,
      publishedAt: entry.publishedAt,
      authorId
    }
  });
};

router.get('/admin', authenticate, authorize(...staffRoles), asyncRoute(async (_req, res) => {
  const entries = await database.cmsEntry.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ entries });
}));

router.post('/admin', authenticate, authorize(...staffRoles), asyncRoute(async (req, res) => {
  const input = entrySchema.safeParse(req.body);
  if (!input.success) throw httpError(400, 'Invalid content entry');
  const sectionError = validateDynamicPageSections(input.data.content);
  if (sectionError) throw httpError(400, sectionError);
  const mediaError = validateCmsMediaContent(input.data.content);
  if (mediaError) throw httpError(400, mediaError);
  const entry = await database.cmsEntry.create({
    data: { ...input.data, content: input.data.content as Prisma.InputJsonValue, status: PublicationStatus.DRAFT, authorId: req.authUser!.id }
  });
  await database.auditLog.create({ data: { actorId: req.authUser!.id, action: 'CMS_CREATE', entity: input.data.type, entityId: entry.id } });
  res.status(201).json({ entry });
}));

router.patch('/admin/:id', authenticate, authorize(...staffRoles), asyncRoute(async (req, res) => {
  const input = entrySchema.partial().safeParse(req.body);
  if (!input.success || Object.keys(input.data).length === 0) throw httpError(400, 'Invalid content update');
  if (input.data.content) {
    const sectionError = validateDynamicPageSections(input.data.content);
    if (sectionError) throw httpError(400, sectionError);
  }
  if (input.data.content) {
    const mediaError = validateCmsMediaContent(input.data.content);
    if (mediaError) throw httpError(400, mediaError);
  }
  const existing = await database.cmsEntry.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw httpError(404, 'Content not found');
  await recordRevision(existing, req.authUser!.id);
  const data: Prisma.CmsEntryUpdateInput = {
    ...(input.data.type !== undefined ? { type: input.data.type } : {}),
    ...(input.data.slug !== undefined ? { slug: input.data.slug } : {}),
    ...(input.data.title !== undefined ? { title: input.data.title } : {}),
    ...(input.data.summary !== undefined ? { summary: input.data.summary } : {}),
    ...(input.data.content !== undefined ? { content: input.data.content as Prisma.InputJsonValue } : {})
  };
  const entry = await database.cmsEntry.update({
    where: { id: req.params.id, deletedAt: null },
    data: { ...data, status: PublicationStatus.DRAFT, publishedAt: null }
  });
  await database.auditLog.create({ data: { actorId: req.authUser!.id, action: 'CMS_UPDATE', entity: entry.type, entityId: entry.id } });
  res.json({ entry });
}));

router.patch('/admin/:id/status', authenticate, authorize(...staffRoles), asyncRoute(async (req, res) => {
  const input = z.object({ status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED']), reason: z.string().max(2000).optional() }).safeParse(req.body);
  if (!input.success) throw httpError(400, 'Invalid publication status');
  const existing = await database.cmsEntry.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw httpError(404, 'Content not found');
  const allowedTransitions: Record<PublicationStatus, PublicationStatus[]> = {
    DRAFT: [PublicationStatus.PENDING_APPROVAL, PublicationStatus.ARCHIVED],
    PENDING_APPROVAL: [PublicationStatus.APPROVED, PublicationStatus.REJECTED, PublicationStatus.ARCHIVED],
    APPROVED: [PublicationStatus.PUBLISHED, PublicationStatus.REJECTED, PublicationStatus.ARCHIVED],
    PUBLISHED: [PublicationStatus.DRAFT, PublicationStatus.ARCHIVED],
    REJECTED: [PublicationStatus.PENDING_APPROVAL, PublicationStatus.ARCHIVED],
    ARCHIVED: []
  };
  if (!allowedTransitions[existing.status].includes(input.data.status)) throw httpError(409, `Cannot move content from ${existing.status} to ${input.data.status}`);
  await recordRevision(existing, req.authUser!.id);
  const entry = await database.cmsEntry.update({
    where: { id: existing.id },
    data: { status: input.data.status, publishedAt: input.data.status === 'PUBLISHED' ? new Date() : null }
  });
  await database.auditLog.create({ data: { actorId: req.authUser!.id, action: `CMS_${input.data.status}`, entity: entry.type, entityId: entry.id, metadata: { reason: input.data.reason ?? null } } });
  res.json({ entry });
}));

router.delete('/admin/:id', authenticate, authorize(...staffRoles), asyncRoute(async (req, res) => {
  const existing = await database.cmsEntry.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw httpError(404, 'Content not found');
  await recordRevision(existing, req.authUser!.id);
  const entry = await database.cmsEntry.update({ where: { id: req.params.id, deletedAt: null }, data: { deletedAt: new Date(), status: PublicationStatus.ARCHIVED } });
  await database.auditLog.create({ data: { actorId: req.authUser!.id, action: 'CMS_SOFT_DELETE', entity: entry.type, entityId: entry.id } });
  res.status(204).end();
}));

router.post('/admin/:id/restore', authenticate, authorize(...staffRoles), asyncRoute(async (req, res) => {
  const existing = await database.cmsEntry.findUnique({ where: { id: req.params.id } });
  if (!existing || (!existing.deletedAt && existing.status !== PublicationStatus.ARCHIVED)) throw httpError(404, 'Archived content not found');
  await recordRevision(existing, req.authUser!.id);
  const entry = await database.cmsEntry.update({
    where: { id: existing.id },
    data: { deletedAt: null, status: PublicationStatus.DRAFT, publishedAt: null }
  });
  await database.auditLog.create({ data: { actorId: req.authUser!.id, action: 'CMS_RESTORE', entity: entry.type, entityId: entry.id } });
  res.json({ entry });
}));

router.get('/admin/:id/revisions', authenticate, authorize(...staffRoles), asyncRoute(async (req, res) => {
  const revisions = await database.cmsRevision.findMany({ where: { entryId: req.params.id }, orderBy: { revisionNumber: 'desc' } });
  res.json({ revisions });
}));

router.post('/admin/:id/revisions/:revisionId/restore', authenticate, authorize(...staffRoles), asyncRoute(async (req, res) => {
  const revision = await database.cmsRevision.findFirst({ where: { id: req.params.revisionId, entryId: req.params.id } });
  if (!revision) throw httpError(404, 'Content revision not found');
  const existing = await database.cmsEntry.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Content not found');
  await recordRevision(existing, req.authUser!.id);
  const entry = await database.cmsEntry.update({
    where: { id: existing.id },
    data: {
      type: revision.type,
      slug: revision.slug,
      title: revision.title,
      summary: revision.summary,
      content: revision.content as Prisma.InputJsonValue,
      status: PublicationStatus.DRAFT,
      deletedAt: null,
      publishedAt: null
    }
  });
  await database.auditLog.create({ data: { actorId: req.authUser!.id, action: 'CMS_REVISION_RESTORE', entity: entry.type, entityId: entry.id, metadata: { revisionNumber: revision.revisionNumber } } });
  res.json({ entry });
}));

router.get('/:type/:slug', asyncRoute(async (req, res) => {
  const entry = await database.cmsEntry.findFirst({ where: { type: req.params.type, slug: req.params.slug, status: PublicationStatus.PUBLISHED, deletedAt: null } });
  if (!entry) throw httpError(404, 'Content not found');
  res.json({ entry });
}));

router.get('/:type', asyncRoute(async (req, res) => {
  const entries = await database.cmsEntry.findMany({ where: { type: req.params.type, status: PublicationStatus.PUBLISHED, deletedAt: null }, orderBy: { publishedAt: 'desc' } });
  res.json({ entries });
}));

return router;
};

export default createCmsRouter();
