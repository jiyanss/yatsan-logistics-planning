'use client';

/* Hedef vs Gerçekleşen görünümü + aylık hedef diyaloğu */
import { useMemo, useState } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable, StatusBadge } from '../Shared';
import { Button } from '@/components/ui/button';
import TargetDialog from '../TargetDialog';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { monthlyAgg } from '@/lib/sevkiyat/analytics';
import { uniq, ymLabel, nf0, nf1 } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { Target, Pencil } from 'lucide-react';

export default function HedefView() {
  const { data, filters, targets } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);
  const rows: Row[] = useMemo(() => applyFilters(data, filters), [data, filters]);
  const [editOpen, setEditOpen] = useState(false);

  const mon = useMemo(() => monthlyAgg(rows), [rows]);
  const byYm = useMemo(() => new Map(mon.map((m) => [m.ym, m] as const)), [mon]);
  const months = useMemo(
    () => uniq(Object.keys(targets).concat(mon.map((m) => m.ym))).sort().reverse(),
    [targets, mon]
  );

  const chartMonths = useMemo(() => months.filter((ym) => targets[ym] && (targets[ym].adet || targets[ym].m3)).reverse().slice(-12), [months, targets]);

  const tRows = months.map((ym) => {
    const t = targets[ym] || { adet: 0, m3: 0 };
    const a = byYm.get(ym) || { adet: 0, m3: 0 };
    const pV = t.adet ? (a.adet / t.adet) * 100 : null;
    const pM = t.m3 ? (a.m3 / t.m3) * 100 : null;
    const vals = [pV, pM].filter((v): v is number => v != null);
    const worst = vals.length ? Math.min(...vals) : null;
    return { ym, t, a, pV, pM, worst };
  });

  return (
    <div className="space-y-4">
      <SectionCard
        icon={<Target className="w-4 h-4" />}
        title="🎯 Hedef vs Gerçekleşen"
        desc="Panelden girin veya Excel'e HEDEF sayfası ekleyin (AY · ARAÇ HEDEF · M3 HEDEF, AY: 2026-01) · Hedefler Firebase'de saklanır"
        action={
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Hedefleri Düzenle
          </Button>
        }
      >
        <DataTable
          rows={tRows}
          maxHeight={460}
          compact
          emptyText="Henüz hedef girilmedi — sağ üstten hedefleri düzenleyin."
          cols={[
            { key: 'ym', header: 'Ay', cell: (r) => <b>{ymLabel(r.ym)}</b> },
            { key: 'tA', header: 'Araç Hedef', align: 'right', cell: (r) => (r.t.adet ? nf0.format(r.t.adet) : '—') },
            { key: 'aA', header: 'Gerçek', align: 'right', cell: (r) => nf0.format(r.a.adet) },
            { key: 'pV', header: '%', align: 'right', cell: (r) => (r.pV == null ? '—' : <span className={r.pV >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>{nf1.format(r.pV)}%</span>) },
            { key: 'tM', header: 'm³ Hedef', align: 'right', cell: (r) => (r.t.m3 ? nf1.format(r.t.m3) : '—') },
            { key: 'aM', header: 'Gerçek m³', align: 'right', cell: (r) => nf1.format(r.a.m3) },
            { key: 'pM', header: '%', align: 'right', cell: (r) => (r.pM == null ? '—' : <span className={r.pM >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>{nf1.format(r.pM)}%</span>) },
            { key: 'st', header: 'Durum', cell: (r) => (r.worst == null ? <span className="text-border">—</span> : <StatusBadge tone={r.worst >= 100 ? 'up' : r.worst >= 80 ? 'mid' : 'dn'} label={r.worst >= 100 ? 'Tuttu' : r.worst >= 80 ? 'Yakın' : 'Geride'} />) },
          ]}
        />
      </SectionCard>

      {chartMonths.length > 0 && (
        <SectionCard icon={<Target className="w-4 h-4" />} title="📊 Hedef ve Gerçekleşen Karşılaştırması" desc="Son 12 hedefli ay">
          <EChart height={340} option={{
            grid: { left: 48, right: 16, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: chartMonths.map((ym) => ymLabel(ym)), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 24 } },
            yAxis: { type: 'value', ...th.axisCommon, name: 'Araç' },
            tooltip: { ...th.tooltip, trigger: 'axis' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
            series: [
              { name: 'Hedef', type: 'bar', data: chartMonths.map((ym) => targets[ym]?.adet || 0), itemStyle: { color: dark ? '#475569' : '#cbd5e1', borderRadius: [5, 5, 0, 0] }, barMaxWidth: 20 },
              { name: 'Gerçek', type: 'bar', data: chartMonths.map((ym) => byYm.get(ym)?.adet ?? 0), itemStyle: { color: th.c.palette[0], borderRadius: [5, 5, 0, 0] }, barMaxWidth: 20 },
            ],
          }} />
        </SectionCard>
      )}

      <TargetDialog open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
