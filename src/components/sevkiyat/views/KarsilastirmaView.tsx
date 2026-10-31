'use client';

/* YENİ — Karşılaştırma: yıl-yıl (YoY) kıyas, Pareto, KPI delta kartları */
import { useMemo, useState } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable, DeltaText } from '../Shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { yoySeries, deptDelta, kpiDelta, pareto } from '@/lib/sevkiyat/comparison';
import { uniq, nf0, nf1, ymLabel } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { GitCompareArrows, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KarsilastirmaView() {
  const { data, filters } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);
  const rows: Row[] = useMemo(() => applyFilters(data, filters), [data, filters]);

  const years = useMemo(
    () => uniq(rows.map((r) => r.yil).filter((y): y is number => !!y)).sort((a, b) => b - a),
    [rows]
  );
  const [yearA, setYearA] = useState<number | null>(null);
  const [yearB, setYearB] = useState<number | null>(null);

  const yA = yearA ?? years[0] ?? new Date().getFullYear();
  const yB = yearB ?? years[1] ?? yA - 1;

  const series = useMemo(() => yoySeries(rows, yA, yB), [rows, yA, yB]);
  const kpis = useMemo(() => kpiDelta(rows, yA, yB), [rows, yA, yB]);
  const deptRows = useMemo(() => deptDelta(rows, yA, yB), [rows, yA, yB]);
  const paretoData = useMemo(() => pareto(rows, 15), [rows]);

  if (!years.length) {
    return <div className="text-sm text-muted-foreground py-16 text-center">Karşılaştırma için tarihli veri yok.</div>;
  }

  const monthsLabels = series.months.map((m) => ymLabel(yA + '-' + m).split(' ')[0]);

  return (
    <div className="space-y-4">
      {/* Yıl seçiciler */}
      <div className="flex flex-wrap items-center gap-3">
        <GitCompareArrows className="w-4.5 h-4.5 text-primary" />
        <span className="text-sm font-semibold">Dönem kıyası:</span>
        <div className="flex items-center gap-2">
          <Select value={String(yA)} onValueChange={(v) => setYearA(+v)}>
            <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">vs</span>
          <Select value={String(yB)} onValueChange={(v) => setYearB(+v)}>
            <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.concat([yA - 1]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <span className="text-[11.5px] text-muted-foreground">Aktif filtreler uygulanır · {rows.length.toLocaleString('tr-TR')} kayıt</span>
      </div>

      {/* KPI delta kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const up = k.delta > 0;
          const flat = k.delta === 0;
          return (
            <Card2 key={k.key}>
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</span>
                <span className={cn('w-6 h-6 rounded-lg flex items-center justify-center',
                  flat ? 'bg-muted text-muted-foreground' : up ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/12 text-red-600 dark:text-red-400')}>
                  {flat ? <Minus className="w-3.5 h-3.5" /> : up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                </span>
              </div>
              <div className="mt-1.5 text-xl font-extrabold tracking-tight tabular-nums">
                {k.fmt === 'n0' ? nf0.format(k.a) : nf1.format(k.a)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {yB}: {k.fmt === 'n0' ? nf0.format(k.b) : nf1.format(k.b)}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11.5px]">
                <DeltaText v={k.delta} />
                {k.pct != null && <DeltaText v={k.pct} suffix="%" />}
              </div>
            </Card2>
          );
        })}
      </div>

      {/* Aylık gruplu bar */}
      <SectionCard
        icon={<GitCompareArrows className="w-4 h-4" />}
        title={`📊 Aylık Araç Sayısı — ${yA} vs ${yB}`}
        desc="Yan yana kıyas; farkı görmek için çubuklara gelin"
      >
        <EChart height={340} option={{
          grid: { left: 48, right: 16, top: 30, bottom: 40 },
          xAxis: { type: 'category', data: monthsLabels, ...th.axisCommon },
          yAxis: { type: 'value', ...th.axisCommon, name: 'Araç' },
          tooltip: { ...th.tooltip, trigger: 'axis' },
          legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
          series: [
            { name: String(yA), type: 'bar', data: series.adetA, itemStyle: { color: th.c.palette[0], borderRadius: [5, 5, 0, 0] }, barMaxWidth: 18 },
            { name: String(yB), type: 'bar', data: series.adetB, itemStyle: { color: dark ? '#64748b' : '#cbd5e1', borderRadius: [5, 5, 0, 0] }, barMaxWidth: 18 },
          ],
        }} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pareto */}
        <SectionCard icon={<GitCompareArrows className="w-4 h-4" />} title="📐 Pareto — En Büyük Müşteriler" desc="m³ (bar) ve kümülatif pay % (çizgi) · %80 çizgisi A/B sınırı">
          <EChart height={340} option={{
            grid: { left: 48, right: 52, top: 30, bottom: 70 },
            xAxis: { type: 'category', data: paretoData.names.map((n) => (n.length > 14 ? n.slice(0, 13) + '…' : n)), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 40, interval: 0 } },
            yAxis: [{ type: 'value', ...th.axisCommon, name: 'm³' }, { type: 'value', ...th.axisCommon, position: 'right', max: 100, name: 'Küm. %', splitLine: { show: false }, axisLabel: { ...th.axisCommon.axisLabel, formatter: '{value}%' } }],
            tooltip: { ...th.tooltip, trigger: 'axis' },
            series: [
              { name: 'm³', type: 'bar', data: paretoData.m3, itemStyle: { color: th.c.palette[0], borderRadius: [5, 5, 0, 0] }, barMaxWidth: 22 },
              { name: 'Kümülatif %', type: 'line', yAxisIndex: 1, data: paretoData.cumPct, smooth: true, symbolSize: 5, lineStyle: { width: 2.5, color: th.c.palette[3] }, itemStyle: { color: th.c.palette[3] }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 80 }], lineStyle: { color: th.c.palette[4], type: 'dashed' as const }, label: { formatter: '%80', color: th.c.palette[4], fontSize: 10 } } },
            ],
          }} />
        </SectionCard>

        {/* m³ aylık kıyas */}
        <SectionCard icon={<GitCompareArrows className="w-4 h-4" />} title={`📈 Aylık m³ — ${yA} vs ${yB}`}>
          <EChart height={340} option={{
            grid: { left: 52, right: 16, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: monthsLabels, ...th.axisCommon },
            yAxis: { type: 'value', ...th.axisCommon, name: 'm³' },
            tooltip: { ...th.tooltip, trigger: 'axis' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
            series: [
              { name: String(yA), type: 'line', smooth: true, data: series.m3A, lineStyle: { width: 2.5, color: th.c.palette[0] }, itemStyle: { color: th.c.palette[0] }, areaStyle: { color: dark ? 'rgba(56,189,248,.1)' : 'rgba(2,132,199,.08)' } },
              { name: String(yB), type: 'line', smooth: true, data: series.m3B, lineStyle: { width: 2, type: 'dashed' as const, color: '#94a3b8' }, itemStyle: { color: '#94a3b8' } },
            ],
          }} />
        </SectionCard>
      </div>

      {/* Bölüm kıyası */}
      <SectionCard icon={<GitCompareArrows className="w-4 h-4" />} title={`🏭 Bölüm Bazında Kıyas — ${yB} → ${yA}`} desc="m³ değişimi ve araç adetleri">
        <DataTable
          rows={deptRows}
          maxHeight={360}
          emptyText="Veri yok"
          cols={[
            { key: 'dep', header: 'Bölüm', cell: (d) => <b>{d.dep}</b> },
            { key: 'm3B', header: yB + ' m³', align: 'right', cell: (d) => nf1.format(d.m3B) },
            { key: 'm3A', header: yA + ' m³', align: 'right', cell: (d) => nf1.format(d.m3A) },
            { key: 'delta', header: 'Δ m³', align: 'right', cell: (d) => <DeltaText v={d.delta} /> },
            { key: 'pct', header: 'Δ %', align: 'right', cell: (d) => <DeltaText v={d.pct} suffix="%" /> },
            { key: 'adetB', header: yB + ' Araç', align: 'right', cell: (d) => nf0.format(d.adetB) },
            { key: 'adetA', header: yA + ' Araç', align: 'right', cell: (d) => nf0.format(d.adetA) },
          ]}
        />
      </SectionCard>
    </div>
  );
}

function Card2({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-3.5 shadow-sm">{children}</div>;
}
