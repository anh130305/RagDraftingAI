/**
 * Persistent store for KnowledgeBase processing state.
 *
 * When the user starts an ingest/uningest/delete action on documents,
 * we save those document IDs to sessionStorage so that the loading
 * effects survive component unmount/remount (tab switching).
 *
 * A TTL (10 min) acts as a safety net in case the action finishes
 * while the component is unmounted and the cleanup callback never runs.
 */

const STORAGE_KEY = 'kb_processing';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface ProcessingEntry {
  /** Document IDs being processed */
  ids: string[];
  /** Human-readable action label for display */
  action: 'ingest' | 'uningest' | 'delete' | 'batch-ingest' | 'batch-uningest' | 'batch-delete';
  /** Epoch ms when the action started — used for TTL expiry */
  startedAt: number;
}

function read(): ProcessingEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry: ProcessingEntry = JSON.parse(raw);

    // Expire stale entries (safety net)
    if (Date.now() - entry.startedAt > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return entry;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/** Save an active processing action. */
export function setProcessing(ids: string[], action: ProcessingEntry['action']): void {
  const entry: ProcessingEntry = { ids, action, startedAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

/** Clear the processing entry entirely. */
export function clearProcessing(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Remove specific document IDs from the processing set (e.g. after polling detects completion). */
export function removeProcessingIds(idsToRemove: string[]): void {
  const entry = read();
  if (!entry) return;
  const remaining = entry.ids.filter(id => !idsToRemove.includes(id));
  if (remaining.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    entry.ids = remaining;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  }
}

/** Get the current set of processing IDs and the action type. */
export function getProcessing(): { ids: Set<string>; action: ProcessingEntry['action'] | null } {
  const entry = read();
  if (!entry || entry.ids.length === 0) {
    return { ids: new Set(), action: null };
  }
  return { ids: new Set(entry.ids), action: entry.action };
}
