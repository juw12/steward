'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuditStats } from '@/lib/api';
import type { AuditStats } from '@/lib/types';

export default function OverviewPage() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditStats()
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Loading…</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {error ?? 'No data available'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Make sure the Steward proxy is running on port 8080.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalCalls = stats.total;
  const hostileCount = stats.by_category.hostile_injection ?? 0;
  const offTaskCount =
    (stats.by_category.off_task_curious ?? 0) +
    (stats.by_category.off_task_abuse ?? 0);
  const offTaskPct = totalCalls > 0 ? ((offTaskCount / totalCalls) * 100).toFixed(1) : '0.0';
  const hostilePct =
    totalCalls > 0
      ? ((hostileCount / totalCalls) * 100).toFixed(1)
      : '0.0';

  const categoryData = [
    { name: 'On Mission', value: stats.by_category.on_mission ?? 0, fill: 'var(--chart-1)' },
    { name: 'Curious', value: stats.by_category.off_task_curious ?? 0, fill: 'var(--chart-2)' },
    { name: 'Abuse', value: stats.by_category.off_task_abuse ?? 0, fill: 'var(--chart-3)' },
    { name: 'Hostile', value: hostileCount, fill: 'var(--chart-4)' },
  ];

  const featureRows = Object.entries(stats.by_feature).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Calls"
          value={totalCalls.toLocaleString()}
          sub="audit entries"
        />
        <KpiCard
          label="Off-Task Rate"
          value={`${offTaskPct}%`}
          sub={`${offTaskCount} of ${totalCalls} calls`}
          tone={parseFloat(offTaskPct) > 30 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Hostile Rate"
          value={`${hostilePct}%`}
          sub={`${hostileCount} detected`}
          tone={parseFloat(hostilePct) > 5 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Total Cost"
          value={`$${stats.total_cost.toFixed(4)}`}
          sub="cumulative spend"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Calls by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Features Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Features</CardTitle>
        </CardHeader>
        <CardContent>
          {featureRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {featureRows.map(([feature, count]) => (
                  <TableRow key={feature}>
                    <TableCell className="font-medium">{feature}</TableCell>
                    <TableCell className="text-right tabular-nums">{count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {totalCalls > 0
                        ? `${((count / totalCalls) * 100).toFixed(1)}%`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No feature data available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const valueColor =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}


