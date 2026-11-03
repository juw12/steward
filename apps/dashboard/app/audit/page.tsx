'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryBadge, ActionBadge } from '@/components/badges';
import { getAudit, getAuditStats } from '@/lib/api';
import type { AuditEntry, GuardCategory, GuardAction } from '@/lib/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 25;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState('');
  const [action, setAction] = useState('');
  const [feature, setFeature] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, stats] = await Promise.all([
        getAudit({
          limit: PAGE_SIZE,
          offset,
          category: (category || undefined) as GuardCategory | undefined,
          action: (action || undefined) as GuardAction | undefined,
          feature: feature || undefined,
        }),
        getAuditStats(),
      ]);
      setEntries(res.entries);
      setTotal(stats.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  }, [offset, category, action, feature]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <span className="text-sm text-muted-foreground">
          {total.toLocaleString()} entries
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v === 'all' ? '' : v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="on_mission">On Mission</SelectItem>
            <SelectItem value="off_task_curious">Off-Task (Curious)</SelectItem>
            <SelectItem value="off_task_abuse">Off-Task (Abuse)</SelectItem>
            <SelectItem value="hostile_injection">Hostile Injection</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v === 'all' ? '' : v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="allow">Allow</SelectItem>
            <SelectItem value="redirect">Redirect</SelectItem>
            <SelectItem value="block">Block</SelectItem>
          </SelectContent>
        </Select>

        <input
          type="text"
          placeholder="Filter by feature..."
          value={feature}
          onChange={(e) => {
            setFeature(e.target.value);
            setOffset(0);
          }}
          className="h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No audit entries found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Time</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="max-w-60">Message</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{entry.feature}</TableCell>
                    <TableCell>
                      <CategoryBadge category={entry.category} />
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell className="max-w-60 truncate text-sm text-muted-foreground">
                      {entry.user_message ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.total_tokens}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${entry.cost_usd.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
