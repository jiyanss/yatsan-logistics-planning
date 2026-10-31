'use client';

/* Müşteri detay diyaloğu: KPI'lar, aylık trend, bölüm dağılımı, son yüklemeler */
import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EChart, { baseChart } from './EChart';
import { useTheme } from 'next-themes';
import { DataTable } from './Shared';
import { monthlyAgg } from '@/lib/sevkiyat/analytics';
import { nf0, nf1, fmtDate, uniq } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';

export default function CustomerDialog({ name, rows, onClose }: { name: string | null; rows: Row[]; onClose: () => void }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);

  const cRows = useMemo(() => (name ? rows.filter((r) => r.musteri === name) : []), [name, rows]);
  const mon = useMemo(() => monthlyAgg(cRows), [cRows]);

  if (!name || !cRows.length) return null;

  const adet = cRows.reduce((s, r) => s + r.adet, 0);
  const m3 = cRows.reduce((s, r) => s + r.m3, 0);
  const days = uniq(cRows.filter((r) => r.tarih).map((r) => r.tarihStr));
  const dts = days
    .map((s) => {
      const p = s.split('.').map(Number);
      return new Date(p[2], p[1] - 1, p[0]).getTime();
    })
    .sort((a, b) => a - b);
  const avgInt = dts.length > 1 ? nf1.format((dts[dts.length - 1] - dts[0]) / 864e5 / (dts.length - 1)) + ' gün' : '—';
  const last = dts.length ? fmtDate(new Date(dts[dts.length - 1])) : '—';
  const first = dts.length ? fmtDate(new Date(dts[0])) : '—';
  const depMap: Record<string, number> = {};
  cRows.forEach((r) => { depMap[r.bolum] = (depMap[r.bolum] || 0) + r.m3; });
  const deps = Object.keys(depMap).sort();
  const topDep = Object.keys(depMap).sort((a, b) => depMap[b] - depMap[a])[0];
  const recent = cRows.slice().sort((a, b) => (b.tarih?.getTime() ?? 0) - (a.tarih?.getTime() ?? 0)).slice(0, 50);

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="text-base">👤 {name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            ['Araç', nf0.format(adet)],
            ['m³', nf1.format(m3)],
            ['Kayıt', String(cRows.length)],
            ['İlk', first],
            ['Son', last],
            ['Ort. Aralık', avgInt],
            ['En Çok', topDep || '—'],
          ].map(([l, v]) => (
            <div key={l} className="rounded-lg border bg-accent/40 px-2.5 py-2">
              <b className="block text-[13.5px] truncate">{v}</b>
              <span className="text-[10px] text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <h4 className="text-[12.5px] font-semibold mb-1">📈 Aylık Trend</h4>
            <EChart height={260} option={{
              grid: { left: 46, right: 50, top: 24, bottom: 28 },
              xAxis: { type: 'category', data: mon.map((m) => m.ym), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 30 } },
              yAxis: [{ type: 'value', ...th.axisCommon }, { type: 'value', ...th.axisCommon, position: 'right', splitLine: { show: false } }],
              tooltip: { ...th.tooltip, trigger: 'axis' },
              legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 10.5 }, itemWidth: 12 },
              series: [
                { name: 'Araç', type: 'bar', data: mon.map((m) => m.adet), itemStyle: { color: th.c.palette[0], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
                { name: 'm³', type: 'line', yAxisIndex: 1, data: mon.map((m) => +m.m3.toFixed(1)), smooth: true, lineStyle: { width: 2, color: th.c.palette[1] }, itemStyle: { color: th.c.palette[1] } },
              ],
            }} />
          </div>
          <div>
            <h4 className="text-[12.5px] font-semibold mb-1">🏭 Bölüm Dağılımı (m³)</h4>
            <EChart height={260} option={{
              tooltip: { ...th.tooltip, trigger: 'item', formatter: '{b}: {c} m³ ({d}%)' },
              legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 10.5 }, type: 'scroll' },
              series: [{
                type: 'pie', radius: ['40%', '68%'], center: ['50%', '45%'],
                data: deps.map((d, i) => ({ name: d, value: +depMap[d].toFixed(1), itemStyle: { color: th.c.palette[i % th.c.palette.length] } })),
                borderWidth: 2, borderColor: dark ? '#16223a' : '#ffffff',
                label: { show: false },
              }],
            }} />
          </div>
        </div>

        <h4 className="text-[12.5px] font-semibold">📋 Son Yüklemeler</h4>
        <DataTable
          rows={recent}
          maxHeight={280}
          compact
          cols={[
            { key: 't', header: 'Tarih', cell: (r: Row) => r.tarihStr || '—' },
            { key: 'b', header: 'Bölüm', cell: (r: Row) => r.bolum },
            { key: 'tip', header: 'Tip', cell: (r: Row) => r.tip },
            { key: 'a', header: 'Adet', align: 'right', cell: (r: Row) => nf0.format(r.adet) },
            { key: 'm', header: 'm³', align: 'right', cell: (r: Row) => nf1.format(r.m3) },
          ]}
        />
      </DialogContent>
    </Dialog>
  );
}
