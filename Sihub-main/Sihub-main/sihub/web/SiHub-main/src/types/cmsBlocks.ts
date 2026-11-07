export type CmsSectionPlacement = 'top' | 'bottom';
export type CmsAlignment = 'left' | 'center' | 'right';
export type CmsFontSize = 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
export type CmsFontFamily = 'sans' | 'serif' | 'mono';
export type CmsAspectRatio = 'auto' | '1/1' | '4/3' | '16/9' | '9/16';
export type CmsBlockType = 'heading' | 'paragraph' | 'richText' | 'list' | 'link' | 'button' | 'image' | 'video' | 'gallery';

interface CmsBlockBase {
  id: string;
  type: CmsBlockType;
}

export type CmsContentBlock =
  | (CmsBlockBase & { type: 'heading'; text: string; level: 2 | 3 | 4; alignment?: CmsAlignment; color?: string; fontFamily?: CmsFontFamily; fontSize?: CmsFontSize })
  | (CmsBlockBase & { type: 'paragraph'; text: string; alignment?: CmsAlignment; color?: string; fontFamily?: CmsFontFamily; fontSize?: CmsFontSize })
  | (CmsBlockBase & { type: 'richText'; text: string; alignment?: CmsAlignment; color?: string; fontFamily?: CmsFontFamily; fontSize?: CmsFontSize })
  | (CmsBlockBase & { type: 'list'; items: string[]; alignment?: CmsAlignment; color?: string; fontFamily?: CmsFontFamily; fontSize?: CmsFontSize })
  | (CmsBlockBase & { type: 'link'; label: string; url: string; alignment?: CmsAlignment })
  | (CmsBlockBase & { type: 'button'; label: string; url: string; alignment?: CmsAlignment })
  | (CmsBlockBase & { type: 'image'; src: string; alt: string; caption?: string; aspectRatio?: CmsAspectRatio; alignment?: CmsAlignment; position?: CmsAlignment })
  | (CmsBlockBase & { type: 'video'; src: string; alt: string; caption?: string; aspectRatio?: CmsAspectRatio; alignment?: CmsAlignment; position?: CmsAlignment })
  | (CmsBlockBase & { type: 'gallery'; items: { src: string; alt: string; caption?: string }[]; aspectRatio?: CmsAspectRatio });

export interface CmsSectionLayout {
  desktopColumns: 1 | 2 | 3 | 4;
  tabletColumns: 1 | 2 | 3;
  mobileColumns: 1 | 2;
  backgroundColor: string;
  textColor: string;
  spacing: 'compact' | 'normal' | 'spacious';
}

export interface CmsPageSection {
  id: string;
  name: string;
  description?: string;
  placement: CmsSectionPlacement;
  order: number;
  visible: boolean;
  archived: boolean;
  layout: CmsSectionLayout;
  blocks: CmsContentBlock[];
}
