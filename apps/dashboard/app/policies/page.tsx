'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FileJson, X } from 'lucide-react';
import { getPolicies, getPolicy } from '@/lib/api';
import type { PolicySummary, PolicyDetail } from '@/lib/types';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PolicyDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    getPolicies()
      .then(setPolicies)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const viewPolicy = async (name: string) => {
    setDialogOpen(true);
    setDialogLoading(true);
    setSelected(null);
    try {
      const policy = await getPolicy(name);
      setSelected(policy);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load policy');
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
      <p className="text-sm text-muted-foreground">
        Active guardrail policies. Click a policy to inspect its full JSON.
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No policies found. Make sure the proxy is running.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {policies.map((policy) => (
            <Card
              key={policy.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => viewPolicy(policy.name)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {policy.name}
                  </CardTitle>
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {policy.feature_count} features
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">
                {selected?.name ?? 'Loading…'}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {dialogLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : selected ? (
            <div className="max-h-[60vh] overflow-auto rounded-md bg-muted/50 p-4">
              <pre className="text-xs leading-relaxed">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Could not load policy details.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
