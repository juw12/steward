import type {
  AuditResponse,
  AuditStats,
  PolicySummary,
  PolicyDetail,
  GuardCategory,
  GuardAction,
} from './types';

const PROXY_URL =
  process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:8080';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PROXY_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function getAudit(params: {
  limit?: number;
  offset?: number;
  category?: GuardCategory;
  action?: GuardAction;
  feature?: string;
}): Promise<AuditResponse> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.category) qs.set('category', params.category);
  if (params.action) qs.set('action', params.action);
  if (params.feature) qs.set('feature', params.feature);
  return fetchJSON<AuditResponse>(`/v1/audit?${qs}`);
}

export function getAuditStats(): Promise<AuditStats> {
  return fetchJSON<AuditStats>('/v1/audit/stats');
}

export function getPolicies(): Promise<PolicySummary[]> {
  return fetchJSON<{ policies: PolicySummary[] }>('/v1/policies').then(
    (r) => r.policies
  );
}

export function getPolicy(name: string): Promise<PolicyDetail> {
  return fetchJSON<PolicyDetail>(`/v1/policies/${encodeURIComponent(name)}`);
}

export async function checkProxyHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${PROXY_URL}/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
