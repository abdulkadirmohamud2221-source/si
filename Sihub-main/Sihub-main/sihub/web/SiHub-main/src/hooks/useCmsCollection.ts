import { useEffect, useState } from 'react';
import { apiGet, ApiError } from '../services/apiClient';

type CmsEnvelope = {
  entries: { id: string; legacyId?: string | null; slug: string; title: string; summary?: string | null; content: unknown }[];
};

export function useCmsCollection<T>(type: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<CmsEnvelope>(`/api/cms/${encodeURIComponent(type)}`)
      .then(({ entries }) => {
        if (!active) return;
        const mapped = entries.map(entry => {
          const content = entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content)
            ? entry.content as Record<string, unknown>
            : { value: entry.content };
          return {
            ...content,
            id: content.id ?? entry.legacyId ?? entry.id,
            slug: entry.slug,
            title: entry.title ?? content.title,
            summary: entry.summary ?? content.summary ?? ''
          } as T;
        });
        setItems(mapped);
        setError('');
      })
      .catch(reason => {
        if (active) setError(reason instanceof ApiError ? reason.message : 'Unable to load published SiHub content.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type]);

  return { items, loading, error };
}
