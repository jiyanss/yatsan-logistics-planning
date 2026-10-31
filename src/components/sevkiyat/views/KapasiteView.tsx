'use client';

/* Kapasite Doluluk: düzenlenebilir kapasiteler, gerçek vs teorik m³ */
import { useMemo } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable, StatusBadge } from '../Shared';
import { Input } from '@/components/ui/input';
import { useSevkiyat, applyFilters, DEFAULT_CAPS } from '@/lib/sevkiyat/store';
import { capacityRows } from '@/lib/sevkiyat/analytics';
import { uniq, nf0, nf1, toNum } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { Boxes } from 'lucide-react';

export default function KapasiteView() {
  const { data, filters, caps, setCaps } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);
  const rows: Row[] = useMemo(() => applyFilters(data, filters), [data, filters]);
  const tips = useMemo(() => uniq(data.map((r) => r.tip)).sort(), [data]);
  const list = useMemo(() => capacityRows(rows, caps), [rows, caps]);

  const avgUtil = list.length ? list.reduce((s, c) => s + c.util, 0) / list.length : 0;

  return (
    <div className="space-y-4">
      <SectionCard
        icon={<Boxes className="w-4 h-4" />}
        title="📐 Kapasite Doluluk Oranı"
        desc="Doluluk = m³ ÷ (araç × kapasite) · kapasiteleri düzenleyin (tarayıcıya kaydedilir)"
        action={<div className="text-right"><div className="text-lg font-extrabold">{nf1.format(avgUtil)}%</div><div className="text-[10px] uppercase text-muted-foreground">ortalama</div></div>}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tip Kapasiteleri (m³)</div>
            {tips.map((t) => (
              <div key={t} className="grid grid-cols-[1fr_90px] gap-2 items-center">
                <span className="text-[12.5px] font-medium truncate">{t}</span>
                <Input
                  type="number"
                  min={1}
                  value={caps[t] != null ? caps[t] : 68}
                  onChange={(e) => setCaps({ ...caps, [t]: toNum(e.target.value) || 68 })}
                  className="h-8 text-[12.5px]"
                />
              </div>
            ))}
            <button
              onClick={() => setCaps({ ...DEFAULT_CAPS })}
              className="text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2"
            >
              Varsayılanlara dön (40 HC: 68 · KOMPLE TIR: 90)
            </button>
          </div>

          <EChart height={340} option={{
            grid: { left: 56, right: 16, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: list.map((x) => x.tip), ...th.axisCommon },
            yAxis: { type: 'value', ...th.axisCommon, name: 'm³' },
            tooltip: { ...th.tooltip, trigger: 'axis' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
            series: [
              { name: 'Gerçek m³', type: 'bar', data: list.map((x) => +x.m3.toFixed(1)), itemStyle: { color: th.c.palette[1], borderRadius: [6, 6, 0, 0] }, barMaxWidth: 34 },
              { name: 'Teorik m³', type: 'bar', data: list.map((x) => +x.theo.toFixed(1)), itemStyle: { color: dark ? '#475569' : '#cbd5e1', borderRadius: [6, 6, 0, 0] }, barMaxWidth: 34 },
            ],
          }} />
        </div>
      </SectionCard>

      <SectionCard icon={<Boxes className="w-4 h-4" />} title="📋 Tip Bazında Doluluk">
        <DataTable
          rows={list}
          maxHeight={360}
          cols={[
            { key: 'tip', header: 'Tip', cell: (x) => <b>{x.tip}</b> },
            { key: 'cap', header: 'Kapasite', align: 'right', cell: (x) => String(x.cap) },
            { key: 'adet', header: 'Araç', align: 'right', cell: (x) => nf0.format(x.adet) },
            { key: 'm3', header: 'Gerçek m³', align: 'right', cell: (x) => nf1.format(x.m3) },
            { key: 'theo', header: 'Teorik m³', align: 'right', cell: (x) => nf1.format(x.theo) },
            { key: 'util', header: 'Doluluk', align: 'right', cell: (x) => <b>{nf1.format(x.util)}%</b> },
            { key: 'st', header: 'Durum', cell: (x) => <StatusBadge tone={x.util >= 85 ? 'up' : x.util >= 60 ? 'mid' : 'dn'} label={x.util >= 85 ? 'İyi' : x.util >= 60 ? 'Orta' : 'Düşük'} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}
