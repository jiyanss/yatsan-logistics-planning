'use client';

/* Müşteriler (ABC) görünümü: sınıflandırma tablosu + Pareto grafiği */
import { useMemo, useState } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable, ClsBadge } from '../Shared';
import CustomerDialog from '../CustomerDialog';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { custAgg, custLifeRows } from '@/lib/sevkiyat/analytics';
import { nf0, nf1, fmtDate, maxDate, ymLabel } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { Users } from 'lucide-react';

export default function MusView() {
  const { data, filters } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);
  const rows: Row[] = useMemo(() => applyFilters(data, filters), [data, filters]);
  const list = useMemo(() => custAgg(rows), [rows]);
  const life = useMemo(() => custLifeRows(data), [data]);
  const [sel, setSel] = useState<string | null>(null);

  if (!rows.length) {
    return <div className="text-sm text-muted-foreground py-16 text-center">Filtreye uyan müşteri verisi yok.</div>;
  }

  const refYm = maxDate(rows);
  const refLabel = refYm ? ymLabel(refYm.getFullYear() + '-' + String(refYm.getMonth() + 1).padStart(2, '0')) : '';
  const lifeMap = new Map(life.list.map((o) => [o.name, o] as const));

  return (
    <div className="space-y-4">
      <SectionCard
        icon={<Users className="w-4 h-4" />}
        title="👥 Müşteri ABC Sınıflandırması"
        desc={`m³'e göre sıralı · A: ~%80 · B: ~%15 · C: ~%5${refLabel ? ' · referans dönemin: ' + refLabel : ''} · satıra tıklayarak müşteri kartını açın`}
      >
        <DataTable
          rows={list}
          maxHeight={520}
          clickable
          onRowClick={(c) => setSel(c.name)}
          cols={[
            { key: 'i', header: '#', width: '44px', cell: (_c, i) => i + 1 },
            { key: 'name', header: 'Müşteri', cell: (c) => <b className="cursor-pointer hover:text-primary transition-colors">{c.name}</b> },
            { key: 'cls', header: 'Sınıf', cell: (c) => <ClsBadge cls={c.cls} /> },
            { key: 'adet', header: 'Araç', align: 'right', cell: (c) => nf0.format(c.adet) },
            { key: 'm3', header: 'm³', align: 'right', cell: (c) => nf1.format(c.m3) },
            { key: 'share', header: 'Pay %', align: 'right', cell: (c) => nf1.format(c.share) },
            { key: 'cum', header: 'Küm. %', align: 'right', cell: (c) => nf1.format(c.cum) },
            { key: 'loads', header: 'Yükleme Günü', align: 'right', cell: (c) => String(lifeMap.get(c.name)?.loads ?? c.loads) },
            { key: 'gap', header: 'Sessizlik', align: 'right', cell: (c) => { const o = lifeMap.get(c.name); return o?.gap != null ? o.gap + ' gün' : '—'; } },
            { key: 'last', header: 'Son', cell: (c) => (c.last ? fmtDate(c.last) : '—') },
          ]}
        />
      </SectionCard>

      <SectionCard icon={<Users className="w-4 h-4" />} title="📐 Müşteri Pareto (m³)" desc="En büyük müşteriler ve kümülatif pay — %80 eşiği">
        <EChart height={360} option={{
          grid: { left: 56, right: 54, top: 26, bottom: 80 },
          xAxis: { type: 'category', data: list.slice(0, 20).map((c) => (c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name)), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 40, interval: 0 } },
          yAxis: [{ type: 'value', ...th.axisCommon, name: 'm³' }, { type: 'value', ...th.axisCommon, position: 'right', max: 100, name: 'Küm. %', splitLine: { show: false }, axisLabel: { ...th.axisCommon.axisLabel, formatter: '{value}%' } }],
          tooltip: { ...th.tooltip, trigger: 'axis' },
          series: [
            { name: 'm³', type: 'bar', data: list.slice(0, 20).map((c) => +c.m3.toFixed(1)), itemStyle: { color: th.c.palette[0], borderRadius: [5, 5, 0, 0] }, barMaxWidth: 24, cursor: 'pointer' },
            { name: 'Kümülatif %', type: 'line', yAxisIndex: 1, data: list.slice(0, 20).map((c) => +c.cum.toFixed(1)), smooth: true, symbolSize: 5, lineStyle: { width: 2.5, color: th.c.palette[3] }, itemStyle: { color: th.c.palette[3] }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 80 }], lineStyle: { color: th.c.palette[4], type: 'dashed' as const }, label: { formatter: '%80', color: th.c.palette[4], fontSize: 10 } } },
          ],
        }} />
      </SectionCard>

      <CustomerDialog name={sel} rows={rows} onClose={() => setSel(null)} />
    </div>
  );
}
