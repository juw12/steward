'use client';

import { useEffect, useState, useCallback } from 'react';
import { checkProxyHealth } from '@/lib/api';

export function ProxyStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    const ok = await checkProxyHealth();
    setConnected(ok);
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [check]);

  if (connected === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
        Checking…
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        connected
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-red-500/10 text-red-600 dark:text-red-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      {connected ? 'Proxy online' : 'Proxy offline'}
    </span>
  );
}
