'use client';

/* Paylaşılan UI parçaları: bölüm kartı, veri tablosu, durum rozetleri */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function SectionCard({
  title,
  icon,
  desc,
  action,
  children,
  className,
  bodyClass,
}: {
  title: ReactNode;
  icon?: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2.5">
          {icon && <span className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</span>}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-[14px] leading-snug">{title}</CardTitle>
            {desc && <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</div>}
          </div>
          {action && <div className="shrink-0 no-print">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn('pt-0', bodyClass)}>{children}</CardContent>
    </Card>
  );
}

export interface Col<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  cell: (row: T, i: number) => ReactNode;
  sortVal?: (row: T) => number | string;
}

export function DataTable<T>({
  cols,
  rows,
  maxHeight = 420,
  emptyText = 'Veri yok',
  clickable,
  onRowClick,
  highlightLastRow,
  compact,
}: {
  cols: Col<T>[];
  rows: T[];
  maxHeight?: number | string;
  emptyText?: string;
  clickable?: boolean;
  onRowClick?: (row: T) => void;
  highlightLastRow?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="overflow-auto nice-scroll rounded-lg border" style={{ maxHeight }}>
      <table className="w-full text-[12.5px] border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/95 backdrop-blur">
            {cols.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cn(
                  'font-semibold text-[10.5px] uppercase tracking-wide text-muted-foreground px-2.5 py-2 border-b bg-muted/95',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="text-center text-muted-foreground px-3 py-8">{emptyText}</td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr
              key={i}
              onClick={clickable && onRowClick ? () => onRowClick(r) : undefined}
              className={cn(
                'border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors',
                clickable && 'cursor-pointer',
                highlightLastRow && i === rows.length - 1 && 'bg-amber-500/5 font-semibold'
              )}
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    compact ? 'px-2.5 py-1.5' : 'px-2.5 py-2',
                    c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left'
                  )}
                >
                  {c.cell(r, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClsBadge({ cls }: { cls: 'A' | 'B' | 'C' }) {
  const map = {
    A: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25',
    B: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25',
    C: 'bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25',
  };
  return <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ring-1', map[cls])}>{cls}</span>;
}

export function StatusBadge({ label, tone }: { label: string; tone: 'ok' | 'watch' | 'risk' | 'mid' | 'up' | 'dn' | 'neutral' }) {
  const map = {
    ok: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25',
    up: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25',
    watch: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25',
    mid: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25',
    risk: 'bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25',
    dn: 'bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25',
    neutral: 'bg-muted text-muted-foreground ring-border',
  };
  return <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ring-1 whitespace-nowrap', map[tone])}>{label}</span>;
}

export function DeltaText({ v, suffix = '' }: { v: number | null; suffix?: string }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  const s = (v >= 0 ? '+' : '') + v.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + suffix;
  return (
    <span className={cn('font-semibold tabular-nums', v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
      {s}
    </span>
  );
}

export function EmptyState({ icon, title, desc }: { icon?: ReactNode; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">{icon}</div>}
      <div className="font-semibold text-sm">{title}</div>
      {desc && <div className="text-xs text-muted-foreground max-w-sm leading-relaxed">{desc}</div>}
    </div>
  );
}
