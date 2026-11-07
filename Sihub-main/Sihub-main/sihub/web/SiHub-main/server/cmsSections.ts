import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const safeUrl = z.string().trim().min(1).max(2048).refine(value => {
  if (/^\/api\/media\/[A-Za-z0-9_-]+\/public$/.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}, 'Links and media must use a safe relative path or HTTPS URL.');
const base = { id: z.string().trim().min(1).max(100) };
const alignment = z.enum(['left', 'center', 'right']).optional();
const font = z.enum(['sans', 'serif', 'mono']).optional();
const fontSize = z.enum(['sm', 'base', 'lg', 'xl', '2xl', '3xl']).optional();
const ratio = z.enum(['auto', '1/1', '4/3', '16/9', '9/16']).optional();
const blockSchema = z.union([
  z.object({ ...base, type: z.literal('heading'), text: z.string().max(2000), level: z.union([z.literal(2), z.literal(3), z.literal(4)]), alignment, color: color.optional(), fontFamily: font, fontSize }),
  z.object({ ...base, type: z.literal('paragraph'), text: z.string().max(20000), alignment, color: color.optional(), fontFamily: font, fontSize }),
  z.object({ ...base, type: z.literal('richText'), text: z.string().max(20000), alignment, color: color.optional(), fontFamily: font, fontSize }),
  z.object({ ...base, type: z.literal('list'), items: z.array(z.string().max(2000)).max(100), alignment, color: color.optional(), fontFamily: font, fontSize }),
  z.object({ ...base, type: z.literal('link'), label: z.string().trim().min(1).max(300), url: safeUrl, alignment }),
  z.object({ ...base, type: z.literal('button'), label: z.string().trim().min(1).max(300), url: safeUrl, alignment }),
  z.object({ ...base, type: z.literal('image'), src: safeUrl, alt: z.string().max(500), caption: z.string().max(1000).optional(), aspectRatio: ratio, alignment, position: alignment }),
  z.object({ ...base, type: z.literal('video'), src: safeUrl, alt: z.string().max(500), caption: z.string().max(1000).optional(), aspectRatio: ratio, alignment, position: alignment }),
  z.object({ ...base, type: z.literal('gallery'), items: z.array(z.object({ src: safeUrl, alt: z.string().max(500), caption: z.string().max(1000).optional() })).max(40), aspectRatio: ratio })
]);

const sectionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(180),
  description: z.string().max(2000).optional(),
  placement: z.enum(['top', 'bottom']),
  order: z.number().int().min(0),
  visible: z.boolean(),
  archived: z.boolean(),
  layout: z.object({
    desktopColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    tabletColumns: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    mobileColumns: z.union([z.literal(1), z.literal(2)]),
    backgroundColor: color,
    textColor: color,
    spacing: z.enum(['compact', 'normal', 'spacious'])
  }),
  blocks: z.array(blockSchema).max(100)
});

export const validateDynamicPageSections = (content: unknown): string | null => {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const sections = (content as Record<string, unknown>).sections;
  if (sections === undefined) return null;
  const parsed = z.array(sectionSchema).safeParse(sections);
  return parsed.success ? null : 'Page sections contain invalid fields, layout values, or media URLs.';
};
