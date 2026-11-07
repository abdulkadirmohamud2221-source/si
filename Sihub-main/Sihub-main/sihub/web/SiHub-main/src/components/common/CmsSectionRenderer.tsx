import React from 'react';
import { CmsMedia } from './CmsMedia';
import type { CmsContentBlock, CmsPageSection } from '../../types/cmsBlocks';

const fontFamilies = { sans: 'sans-serif', serif: 'serif', mono: 'monospace' } as const;
const fontSizes = { sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' } as const;
const spacing = { compact: '1.5rem', normal: '2.5rem', spacious: '4rem' } as const;
const renderRichText = (text: string) => text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g).map((part, index) => {
  if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
  if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
  if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-black/5 px-1">{part.slice(1, -1)}</code>;
  return part;
});

const TextBlock: React.FC<{ block: Extract<CmsContentBlock, { type: 'heading' | 'paragraph' | 'richText' | 'list' }> }> = ({ block }) => {
  const style: React.CSSProperties = {
    textAlign: block.alignment,
    color: block.color,
    fontFamily: block.fontFamily ? fontFamilies[block.fontFamily] : undefined,
    fontSize: block.fontSize ? fontSizes[block.fontSize] : undefined
  };
  if (block.type === 'heading') {
    const Tag: React.ElementType = `h${block.level}`;
    return <Tag style={style} className="font-bold leading-tight">{block.text}</Tag>;
  }
  if (block.type === 'paragraph') return <p style={style} className="whitespace-pre-wrap leading-relaxed">{block.text}</p>;
  if (block.type === 'richText') return <div style={style} className="space-y-3 leading-relaxed">{block.text.split(/\n{2,}/).map((paragraph, index) => <p key={`${block.id}-${index}`} className="whitespace-pre-wrap">{renderRichText(paragraph)}</p>)}</div>;
  return <ul style={style} className="list-disc space-y-1 pl-5">{block.items.map((item, index) => <li key={`${block.id}-${index}`}>{item}</li>)}</ul>;
};

const MediaBlock: React.FC<{ block: Extract<CmsContentBlock, { type: 'image' | 'video' | 'gallery' }> }> = ({ block }) => {
  if (block.type === 'gallery') return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{block.items.map((item, index) => <CmsMedia key={`${block.id}-${index}`} src={item.src} kind="image" alt={item.alt} caption={item.caption} className="h-full max-h-80 w-full object-cover" />)}</div>;
  const kind = block.type;
  return <div className={`mx-auto w-full max-w-5xl ${block.alignment === 'left' ? 'mr-auto' : block.alignment === 'right' ? 'ml-auto' : ''}`} style={{ aspectRatio: block.aspectRatio === 'auto' ? undefined : block.aspectRatio }}><CmsMedia src={block.src} kind={kind} alt={block.alt} caption={block.caption} className="h-full w-full object-cover" /></div>;
};

const Block: React.FC<{ block: CmsContentBlock }> = ({ block }) => {
  if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'richText' || block.type === 'list') return <TextBlock block={block} />;
  if (block.type === 'image' || block.type === 'video' || block.type === 'gallery') return <MediaBlock block={block} />;
  const className = block.type === 'button' ? 'inline-flex rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800' : 'font-semibold text-cyan-800 underline';
  return <div style={{ textAlign: block.alignment }}><a href={block.url} className={className}>{block.label}</a></div>;
};

export const CmsSectionRenderer: React.FC<{ section: CmsPageSection }> = ({ section }) => {
  if (!section.visible || section.archived) return null;
  const gridStyle = {
    '--cms-columns-mobile': section.layout.mobileColumns,
    '--cms-columns-tablet': section.layout.tabletColumns,
    '--cms-columns-desktop': section.layout.desktopColumns
  } as React.CSSProperties;
  return (
    <section id={`cms-${section.id}`} aria-label={section.name} className="cms-section" style={{ backgroundColor: section.layout.backgroundColor, color: section.layout.textColor, paddingBlock: spacing[section.layout.spacing] }}>
      <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8">
        {(section.name || section.description) && <header><h2 className="text-2xl font-bold">{section.name}</h2>{section.description && <p className="mt-2 text-sm opacity-80">{section.description}</p>}</header>}
        <div className="cms-section-grid" style={gridStyle}>{section.blocks.map(block => <div key={block.id} className="min-w-0 space-y-3"><Block block={block} /></div>)}</div>
      </div>
    </section>
  );
};
