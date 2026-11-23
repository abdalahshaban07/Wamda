import { catalog, Lang } from './catalog';
export interface Collection {
  id: string;
  name: string;
}
export interface State {
  version: 1;
  lang: Lang;
  likes: string[];
  saved: Record<string, string>;
  collections: Collection[];
}
export const STORAGE_KEY = 'cofeed.local.v1';
export function fresh(): State {
  return {
    version: 1,
    lang: 'ar',
    likes: [],
    saved: {},
    collections: [{ id: 'inbox', name: 'Inbox' }],
  };
}
export function parseState(input: string): State {
  if (input.length > 200000) throw new Error('size');
  const x: unknown = JSON.parse(input);
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('shape');
  const a = x as Record<string, unknown>;
  if (
    a['version'] !== 1 ||
    !['ar', 'en'].includes(a['lang'] as string) ||
    !Array.isArray(a['collections']) ||
    a['collections'].length < 1 ||
    a['collections'].length > 30 ||
    !Array.isArray(a['likes']) ||
    !a['saved'] ||
    typeof a['saved'] !== 'object' ||
    Array.isArray(a['saved'])
  )
    throw new Error('shape');
  const collections: Collection[] = a['collections'].map((v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v))
      throw new Error('collection');
    const c = v as Record<string, unknown>;
    if (
      typeof c['id'] !== 'string' ||
      !/^[-a-zA-Z0-9_]{1,80}$/.test(c['id']) ||
      typeof c['name'] !== 'string' ||
      !c['name'].trim() ||
      c['name'].trim().length > 40
    )
      throw new Error('collection');
    return { id: c['id'], name: c['name'].trim() };
  });
  if (
    new Set(collections.map((c) => c.id)).size !== collections.length ||
    new Set(collections.map((c) => c.name.toLocaleLowerCase())).size !==
      collections.length ||
    !collections.some((c) => c.id === 'inbox')
  )
    throw new Error('duplicate');
  const ids = new Set(catalog.map((p) => p.id));
  const likes = a['likes'] as unknown[];
  if (
    likes.length > ids.size ||
    likes.some((v) => typeof v !== 'string' || !ids.has(v)) ||
    new Set(likes).size !== likes.length
  )
    throw new Error('likes');
  const saved: Record<string, string> = {};
  for (const [k, v] of Object.entries(a['saved'] as object)) {
    if (
      !ids.has(k) ||
      typeof v !== 'string' ||
      !collections.some((c) => c.id === v)
    )
      throw new Error('saved');
    saved[k] = v;
  }
  return {
    version: 1,
    lang: a['lang'] as Lang,
    likes: likes as string[],
    collections,
    saved,
  };
}
export interface StoragePort {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
export function readState(storage: StoragePort): {
  state: State;
  issue: 'none' | 'corrupt' | 'unavailable';
  raw: string | null;
} {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: fresh(), issue: 'unavailable', raw: null };
  }
  if (raw === null) return { state: fresh(), issue: 'none', raw: null };
  try {
    return { state: parseState(raw), issue: 'none', raw };
  } catch {
    return { state: fresh(), issue: 'corrupt', raw };
  }
}
export function writeState(storage: StoragePort, state: State): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
