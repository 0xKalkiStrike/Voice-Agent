/**
 * Long-term memory, honest edition.
 *
 * PRD P9: memories live behind the aura-store API once Supabase is wired.
 * Until that API exists this is a session-scoped store: it works end-to-end
 * in the tab, and the UI says plainly that it is NOT persisted yet. Nothing
 * here pretends to be durable storage.
 */

export type MemoryType = "conversation-summary" | "project-context" | "preference";

export interface MemoryEntry {
  id: string;
  text: string;
  type: MemoryType;
  at: number;
}

export interface MemoryStore {
  list(): MemoryEntry[];
  save(text: string, type?: MemoryType): MemoryEntry;
  /** Keyword recall: entries whose text matches the most query tokens first. */
  recall(query: string, limit?: number): MemoryEntry[];
  findById(id: string): MemoryEntry | undefined;
  remove(id: string): boolean;
  /** True when no entry matched. */
  removeWhere(predicate: (entry: MemoryEntry) => boolean): number;
  clear(): number;
}

let memCounter = 0;
function nextMemoryId(): string {
  memCounter += 1;
  return `mem${memCounter}`;
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "for",
  "and",
  "in",
  "on",
  "with",
  "from",
  "about",
  "what",
  "when",
  "where",
  "who",
  "did",
  "do",
  "does",
  "my",
  "me",
  "it",
  "is",
  "are",
  "that",
  "i",
  "you",
  "asked",
]);

export function memoryTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export function createMemoryStore(): MemoryStore {
  let entries: MemoryEntry[] = [];

  const list = (): MemoryEntry[] => [...entries].sort((a, b) => b.at - a.at);

  const save = (text: string, type: MemoryType = "conversation-summary"): MemoryEntry => {
    const entry: MemoryEntry = { id: nextMemoryId(), text: text.trim(), type, at: Date.now() };
    entries = [...entries, entry];
    return entry;
  };

  const recall = (query: string, limit = 3): MemoryEntry[] => {
    const tokens = memoryTokens(query);
    if (tokens.length === 0) return [];
    const scored = entries.map((entry) => {
      const textTokens = new Set(memoryTokens(entry.text));
      let score = 0;
      for (const t of tokens) if (textTokens.has(t)) score += 1;
      return { entry, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.at - a.entry.at)
      .slice(0, limit)
      .map((s) => s.entry);
  };

  const findById = (id: string): MemoryEntry | undefined => entries.find((e) => e.id === id);

  const remove = (id: string): boolean => {
    const before = entries.length;
    entries = entries.filter((e) => e.id !== id);
    return entries.length < before;
  };

  const removeWhere = (predicate: (entry: MemoryEntry) => boolean): number => {
    const before = entries.length;
    entries = entries.filter((e) => !predicate(e));
    return before - entries.length;
  };

  const clear = (): number => {
    const n = entries.length;
    entries = [];
    return n;
  };

  return { list, save, recall, findById, remove, removeWhere, clear };
}

/** Single shared store used by the agent tools and the Memory panel. */
export const memoryStore = createMemoryStore();