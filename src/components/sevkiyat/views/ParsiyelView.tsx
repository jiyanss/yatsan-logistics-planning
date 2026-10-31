'use client';

/* Parsiyel Analizi: KPI'lar, aylık trend, müşteri tablosu, konsolidasyon fırsatları */
import { useMemo } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable } from '../Shared';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { parsiyelRows, parsiyelConsolidation, monthlyAgg } from '@/lib/sevkiyat/analytics';
import { nf0, nf1, fmtDate } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { Package } from 'lucide-react';

export default function ParsiyelView() {
  const { data, filters, caps } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);
  const rows: Row[] = useMemo(() => applyFilters(data, filters), [data, filters]);

  const par = useMemo(() => parsiyelRows(data), [data]);
  const mon = useMemo(() => monthlyAgg(par), [par]);
  const cons = useMemo(() => parsiyelConsolidation(data, caps), [data, caps]);

  const byCust = useMemo(() => {
    const m = new Map<string, { name: string; adet: number; m3: number; n: number; last: Date | null }>();
    par.forEach((r) => {
      if (!m.has(r.musteri)) m.set(r.musteri, { name: r.musteri, adet: 0, m3: 0, n: 0, last: null });
      const o = m.get(r.musteri)!;
      o.adet += r.adet;
      o.m3 += r.m3;
      o.n++;
      if (r.tarih && (!o.last || r.tarih > o.last)) o.last = r.tarih;
    });
    return Array.from(m.values()).sort((a, b) => b.m3 - a.m3);
  }, [par]);

  const adet = par.reduce((s, r) => s + r.adet, 0);
  const m3 = par.reduce((s, r) => s + r.m3, 0);
  const cap = caps['KOMPLE TIR'] || 90;

  if (!par.length) {
    return (
      <SectionCard icon={<Package className="w-4 h-4" />} title="📦 Parsiyel Analizi">
        <div className="text-sm text-muted-foreground py-10 text-center">
          Veride &quot;PARSİYEL&quot; tipinde kayıt yok. Sevkiyat tipi kolonunda PARSİYEL TIR gibi kayıtlar olmalı.
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Parsiyel Araç', nf0.format(adet)],
          ['Parsiyel m³', nf1.format(m3)],
          ['Ort. m³ / Araç', adet ? nf1.format(m3 / adet) : '—'],
          ['Müşteri', nf0.format(new Set(par.map((r) => r.musteri)).size)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-3.5 shadow-sm">
            <div className="text-lg font-extrabold tracking-tight">{v}</div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      <SectionCard icon={<Package className="w-4 h-4" />} title="📦 Parsiyel Yükleme Trendi" desc={`Aktif filtrede ${nf0.format(rows.length)} kayıttan ${nf0.format(par.length)} tanesi parsiyel tipinde`}>
        <EChart height={320} option={{
          grid: { left: 48, right: 52, top: 30, bottom: 40 },
          xAxis: { type: 'category', data: mon.map((m) => m.ym), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 30 } },
          yAxis: [{ type: 'value', ...th.axisCommon, name: 'Araç' }, { type: 'value', ...th.axisCommon, position: 'right', name: 'm³', splitLine: { show: false } }],
          tooltip: { ...th.tooltip, trigger: 'axis' },
          legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
          series: [
            { name: 'Araç', type: 'bar', data: mon.map((m) => m.adet), itemStyle: { color: th.c.palette[2], borderRadius: [5, 5, 0, 0] }, barMaxWidth: 24 },
            { name: 'm³', type: 'line', yAxisIndex: 1, data: mon.map((m) => +m.m3.toFixed(1)), smooth: true, lineStyle: { width: 2.5, color: th.c.palette[1] }, itemStyle: { color: th.c.palette[1] }, areaStyle: { color: dark ? 'rgba(52,211,153,.1)' : 'rgba(5,150,105,.08)' } },
          ],
        }} />
      </SectionCard>

      <SectionCard icon={<Package className="w-4 h-4" />} title="👥 Müşteri Bazlı Parsiyel">
        <DataTable
          rows={byCust}
          maxHeight={340}
          compact
          cols={[
            { key: 'name', header: 'Müşteri', cell: (o) => <b>{o.name}</b> },
            { key: 'n', header: 'Yükleme', align: 'right', cell: (o) => String(o.n) },
            { key: 'adet', header: 'Araç', align: 'right', cell: (o) => nf0.format(o.adet) },
            { key: 'm3', header: 'm³', align: 'right', cell: (o) => nf1.format(o.m3) },
            { key: 'avg', header: 'Ort. m³/A', align: 'right', cell: (o) => (o.adet ? nf1.format(o.m3 / o.adet) : '—') },
            { key: 'last', header: 'Son', cell: (o) => (o.last ? fmtDate(o.last) : '—') },
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={<Package className="w-4 h-4" />}
        title="🔗 Konsolidasyon Fırsatları"
        desc={`Aynı haftada 2+ parsiyel birleştirilirse · KOMPLE TIR ${cap} m³ varsayımı`}
      >
        <DataTable
          rows={cons}
          maxHeight={380}
          compact
          emptyText="Fırsat görünmüyor 👍"
          cols={[
            { key: 'w', header: 'Hafta', cell: (o) => <b>{o.yil}/H{o.hafta}</b> },
            { key: 'custs', header: 'Müşteriler', cell: (o) => {
              const arr = Array.from(o.custs);
              return <span className="line-clamp-2">{arr.slice(0, 3).join(', ')}{arr.length > 3 ? ' +' + (arr.length - 3) : ''}</span>;
            } },
            { key: 'n', header: 'Parsiyel', align: 'right', cell: (o) => String(o.n) },
            { key: 'adet', header: 'Araç', align: 'right', cell: (o) => nf0.format(o.adet) },
            { key: 'm3', header: 'm³', align: 'right', cell: (o) => nf1.format(o.m3) },
            { key: 'pot', header: 'Birleşik', align: 'right', cell: (o) => '~' + o.pot + ' araç' },
            { key: 'save', header: 'Tasarruf', align: 'right', cell: (o) => (o.save > 0 ? <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25">≈ {o.save} araç</span> : <span className="text-border">—</span>) },
          ]}
        />
      </SectionCard>
    </div>
  );
}
