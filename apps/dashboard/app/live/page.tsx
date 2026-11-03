'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryBadge, ActionBadge } from '@/components/badges';
import { Skeleton } from '@/components/ui/skeleton';
import { getAudit } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';
import { Radio } from 'lucide-react';

const LIVE_LIMIT = 20;
const POLL_FALLBACK_MS = 5000;
const PROXY_URL =
  process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:8080';

let nextLocalId = -1;

export default function LivePage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [transport, setTransport] = useState<'sse' | 'polling' | null>(null);
  const [hasNew, setHasNew] = useState(false);

  const fetchInitial = useCallback(async () => {
    try {
      const res = await getAudit({ limit: LIVE_LIMIT, offset: 0 });
      setEntries(res.entries);
    } catch {
      setConnected(false);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const tryPollingFallback = () => {
      if (cancelled || transport === 'polling') return;
      setTransport('polling');
      const tick = async () => {
        if (cancelled) return;
        try {
          const res = await getAudit({ limit: LIVE_LIMIT, offset: 0 });
          if (cancelled) return;
          setEntries(res.entries);
          setConnected(true);
          setLastUpdate(new Date());
        } catch {
          setConnected(false);
        }
        pollTimer = setTimeout(tick, POLL_FALLBACK_MS);
      };
      tick();
    };

    fetchInitial();

    const es = new EventSource(`${PROXY_URL}/v1/audit/stream`);

    es.addEventListener('audit', (e: MessageEvent) => {
      if (cancelled) return;
      try {
        const incoming = JSON.parse(e.data) as Omit<AuditEntry, 'id'>;
        const entry: AuditEntry = {
          ...incoming,
          id: nextLocalId--,
          timestamp: new Date().toISOString(),
        };
        setEntries((prev) => [entry, ...prev].slice(0, LIVE_LIMIT));
        setConnected(true);
        setTransport('sse');
        setLastUpdate(new Date());
        setHasNew(true);
        setTimeout(() => setHasNew(false), 600);
      } catch {
        // ignore malformed event
      }
    });

    es.onopen = () => {
      if (cancelled) return;
      setConnected(true);
      setTransport('sse');
    };

    es.onerror = () => {
      if (cancelled) return;
      setConnected(false);
      es.close();
      tryPollingFallback();
    };

    return () => {
      cancelled = true;
      es.close();
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [fetchInitial]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Live</h1>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              connected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
          >
            <Radio className="h-3 w-3" />
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdate.toLocaleTimeString()}
            {transport && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {transport === 'sse' ? 'SSE' : 'polling'}
              </span>
            )}
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Recent entries ({entries.length})
            {hasNew && (
              <span className="ml-2 inline-block animate-pulse text-xs text-emerald-500">
                new
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {initialLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No recent entries. Waiting for traffic…
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm transition-colors ${
                    idx === 0 && hasNew
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-card'
                  }`}
                >
                  <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="w-24 shrink-0 font-medium">
                    {entry.feature}
                  </span>
                  <CategoryBadge category={entry.category} />
                  <ActionBadge action={entry.action} />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {entry.reason ?? entry.user_message ?? ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Real-time stream{transport === 'polling' && ' (polling fallback)'} from proxy
      </p>
    </div>
  );
}
