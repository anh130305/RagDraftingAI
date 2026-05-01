import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, RefreshCw, AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';

/* ────────────── Types ────────────── */
interface CollectionStat { name: string; count: number }

/* ────────────── Main Component ────────────── */
export default function RAGPanel() {
  // ── ChromaDB Status ──
  const [collections, setCollections] = useState<CollectionStat[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [ragOnline, setRagOnline] = useState<boolean | null>(null);

  // ── Fetch Status ──
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await api.getRAGStatus();
      const arr = Object.entries(data).map(([name, count]) => ({ name, count: count as number }));
      setCollections(arr);
      setRagOnline(true);
    } catch {
      setRagOnline(false);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const totalChunks = collections.reduce((s, c) => s + (c.count >= 0 ? c.count : 0), 0);

  // ── UI ──
  return (
    <div className="glass-card rounded-xl p-4 border border-outline-variant/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-on-surface">ChromaDB Vector Store</h4>
          {ragOnline !== null && (
            <span className={cn(
              "px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider",
              ragOnline
                ? "bg-green-500/10 text-green-500 border-green-500/20"
                : "bg-error/10 text-error border-error/20"
            )}>
              {ragOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          )}
        </div>
        <button onClick={fetchStatus} disabled={statusLoading}
          className="p-1.5 rounded-lg hover:bg-surface-highest transition-colors text-on-surface-variant">
          <RefreshCw className={cn("w-3.5 h-3.5", statusLoading && "animate-spin")} />
        </button>
      </div>

      {statusLoading && collections.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-lg bg-surface-highest animate-pulse" />)}
        </div>
      ) : ragOnline === false ? (
        <div className="text-xs text-error flex items-center gap-2 py-3">
          <AlertCircle className="w-4 h-4" /> RAG Service không phản hồi. Kiểm tra container rag_service.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Tổng vectors</p>
            <p className="text-lg font-extrabold font-headline text-primary">{totalChunks.toLocaleString()}</p>
          </div>
          {collections.map(c => (
            <div key={c.name} className="p-3 rounded-lg bg-surface-highest/60 border border-outline-variant/20">
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant truncate" title={c.name}>{c.name}</p>
              <p className="text-lg font-extrabold font-headline">{c.count >= 0 ? c.count.toLocaleString() : '❌'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
