'use client';

/* Aylık Karşılaştırma & Trend: son 12 ay, yığın bölüm payı, MoM/YoY, takvim ısı haritası, gün analizi */
import { useMemo, useState } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable, DeltaText } from '../Shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { monthlyAgg, weekdayData, heatmapData } from '@/lib/sevkiyat/analytics';
import { uniq, ymLabel, nf0, nf1, pad2 } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { CalendarRange } from 'lucide-react';

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export default function AylikView() {
  const { data, filters } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);
  const rows = useMemo(() => applyFilters(data, filters), [data, filters]);
  const dated = useMemo(() => rows.filter((r) => r.tarih), [rows]);

  const years = useMemo(() => uniq(dated.map((r) => r.tarih!.getFullYear())).sort((a, b) => b - a), [dated]);
  const [hmYear, setHmYear] = useState<number | null>(null);
  const heatYear = hmYear ?? years[0] ?? new Date().getFullYear();

  const mon = useMemo(() => monthlyAgg(rows), [rows]);
  const last12 = mon.slice(-12);
  const byYm = useMemo(() => new Map(mon.map((m) => [m.ym, m] as const)), [mon]);
  const deps = useMemo(() => uniq(dated.map((r) => r.bolum)).sort(), [dated]);

  const momRows = useMemo(() => {
    const desc = mon.slice().reverse();
    return desc.slice(0, 24).map((m) => {
      const p = m.ym.split('-');
      const prevKey = +p[1] === 1 ? +p[0] - 1 + '-12' : p[0] + '-' + pad2(+p[1] - 1);
      const pyKey = +p[0] - 1 + '-' + p[1];
      const pm = byYm.get(prevKey);
      const py = byYm.get(pyKey);
      return {
        ym: m.ym,
        adet: m.adet,
        momV: pm && pm.adet ? ((m.adet - pm.adet) / pm.adet) * 100 : null,
        yoyV: py && py.adet ? ((m.adet - py.adet) / py.adet) * 100 : null,
        m3: m.m3,
        momM: pm && pm.m3 ? ((m.m3 - pm.m3) / pm.m3) * 100 : null,
        yoyM: py && py.m3 ? ((m.m3 - py.m3) / py.m3) * 100 : null,
      };
    });
  }, [mon, byYm]);

  const wd = useMemo(() => weekdayData(rows), [rows]);
  const heat = useMemo(() => heatmapData(rows), [rows]);

  // Takvim grid verisi
  const calendarData = useMemo(() => {
    const out: [string, number][] = [];
    heat.forEach((v, k) => { if (k.startsWith(heatYear + '-')) out.push([k, +v.m3.toFixed(1)]); });
    return out;
  }, [heat, heatYear]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={<CalendarRange className="w-4 h-4" />} title="📆 Son 12 Ay" desc="Araç (bar) ve m³ (çizgi)">
          <EChart height={300} option={{
            grid: { left: 48, right: 54, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: last12.map((m) => ymLabel(m.ym)), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 24 } },
            yAxis: [{ type: 'value', ...th.axisCommon, name: 'Araç' }, { type: 'value', ...th.axisCommon, position: 'right', name: 'm³', splitLine: { show: false } }],
            tooltip: { ...th.tooltip, trigger: 'axis' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
            series: [
              { name: 'Araç', type: 'bar', data: last12.map((m) => m.adet), itemStyle: { color: th.c.palette[0], borderRadius: [5, 5, 0, 0] }, barMaxWidth: 26 },
              { name: 'm³', type: 'line', yAxisIndex: 1, data: last12.map((m) => +m.m3.toFixed(1)), smooth: true, lineStyle: { width: 2.5, color: th.c.palette[2] }, itemStyle: { color: th.c.palette[2] } },
            ],
          }} />
        </SectionCard>

        <SectionCard icon={<CalendarRange className="w-4 h-4" />} title="📊 Bölüm Payı Trendi" desc="m³, yığın çubuk">
          <EChart height={300} option={{
            grid: { left: 48, right: 16, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: last12.map((m) => ymLabel(m.ym)), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 24 } },
            yAxis: { type: 'value', ...th.axisCommon, name: 'm³' },
            tooltip: { ...th.tooltip, trigger: 'axis' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 }, type: 'scroll' },
            series: deps.map((d, i) => ({
              name: d, type: 'bar' as const, stack: 's',
              data: last12.map((m) => +(m.deps[d] || 0).toFixed(1)),
              itemStyle: { color: th.c.palette[i % th.c.palette.length] },
              barMaxWidth: 30,
            })),
          }} />
        </SectionCard>
      </div>

      <SectionCard icon={<CalendarRange className="w-4 h-4" />} title="🔄 Aylık Karşılaştırma (MoM / YoY)" desc="Ay-ay ve yıl-yıl yüzde değişim">
        <DataTable
          rows={momRows}
          maxHeight={380}
          emptyText="Veri yok"
          compact
          cols={[
            { key: 'ym', header: 'Ay', cell: (m) => <b>{ymLabel(m.ym)}</b> },
            { key: 'adet', header: 'Araç', align: 'right', cell: (m) => nf0.format(m.adet) },
            { key: 'momV', header: 'MoM', align: 'right', cell: (m) => <DeltaText v={m.momV} suffix="%" /> },
            { key: 'yoyV', header: 'YoY', align: 'right', cell: (m) => <DeltaText v={m.yoyV} suffix="%" /> },
            { key: 'm3', header: 'm³', align: 'right', cell: (m) => nf1.format(m.m3) },
            { key: 'momM', header: 'MoM m³', align: 'right', cell: (m) => <DeltaText v={m.momM} suffix="%" /> },
            { key: 'yoyM', header: 'YoY m³', align: 'right', cell: (m) => <DeltaText v={m.yoyM} suffix="%" /> },
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={<CalendarRange className="w-4 h-4" />}
        title="🔥 Takvim Isı Haritası"
        desc="Günlük m³ yoğunluğu — koyu renk = daha çok yükleme"
        action={
          years.length ? (
            <Select value={String(heatYear)} onValueChange={(v) => setHmYear(+v)}>
              <SelectTrigger size="sm" className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          ) : undefined
        }
      >
        {calendarData.length ? (
          <EChart height={220} option={{
            visualMap: {
              min: 0, max: Math.max(...calendarData.map((d) => d[1]), 1),
              orient: 'horizontal', left: 'center', bottom: 0,
              inRange: { color: dark ? ['#1e293b', '#38bdf8', '#0ea5e9'] : ['#dcfce7', '#4ade80', '#16a34a', '#166534'] },
              textStyle: { color: th.c.muted, fontSize: 10 },
              itemHeight: 60, itemWidth: 12,
            },
            calendar: {
              top: 30, left: 40, right: 16, cellSize: ['auto', 14],
              range: heatYear,
              splitLine: { show: false },
              dayLabel: { nameMap: ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'], color: th.c.muted, fontSize: 10 },
              monthLabel: { nameMap: AYLAR, color: th.c.muted, fontSize: 10 },
              yearLabel: { show: false },
              itemStyle: { color: dark ? 'rgba(148,163,184,.06)' : 'rgba(100,116,139,.07)', borderWidth: 2, borderColor: dark ? '#0f1828' : '#ffffff', borderRadius: 3 },
            },
            tooltip: { ...th.tooltip },
            series: [{
              type: 'heatmap', coordinateSystem: 'calendar', data: calendarData,
              itemStyle: { borderRadius: 3 },
            }],
          }} />
        ) : (
          <div className="text-sm text-muted-foreground py-8 text-center">Bu yıl için tarihli veri yok.</div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={<CalendarRange className="w-4 h-4" />} title="📅 Haftanın Günü" desc="Seri maksimumuna göre yüzde dağılım">
          <EChart height={280} option={{
            grid: { left: 44, right: 16, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: wd.labels, ...th.axisCommon },
            yAxis: { type: 'value', max: 100, ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, formatter: '{value}%' } },
            tooltip: { ...th.tooltip, trigger: 'axis', valueFormatter: (v) => nf1.format(Number(v)) },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
            series: [
              { name: 'Ort. m³/Gün', type: 'bar', data: wd.realM3.map((v) => +((v / Math.max(...wd.realM3, 1)) * 100).toFixed(1)), itemStyle: { color: th.c.palette[1], borderRadius: [6, 6, 0, 0] }, barMaxWidth: 30 },
              { name: 'Ort. Araç/Gün', type: 'bar', data: wd.realA.map((v) => +((v / Math.max(...wd.realA, 1)) * 100).toFixed(1)), itemStyle: { color: th.c.palette[0], borderRadius: [6, 6, 0, 0] }, barMaxWidth: 30 },
            ],
          }} />
          <div className="text-[10.5px] text-muted-foreground mt-2">
            Gerçek ortalamalar: {wd.labels.map((l, i) => l + ' ' + nf1.format(wd.realM3[i]) + ' m³').join(' · ')}
          </div>
        </SectionCard>

        <SectionCard icon={<CalendarRange className="w-4 h-4" />} title="📅 Gün Detayları">
          <DataTable
            rows={[1, 2, 3, 4, 5, 6, 0]}
            maxHeight={300}
            compact
            cols={[
              { key: 'g', header: 'Gün', cell: (d: number) => wd.labels[[1, 2, 3, 4, 5, 6, 0].indexOf(d)] },
              { key: 'adet', header: 'Araç', align: 'right', cell: (d: number) => nf0.format(wd.agg[d]?.adet ?? 0) },
              { key: 'm3', header: 'm³', align: 'right', cell: (d: number) => nf1.format(wd.agg[d]?.m3 ?? 0) },
              { key: 'days', header: 'Gün', align: 'right', cell: (d: number) => String(wd.agg[d]?.days ?? 0) },
              { key: 'avgA', header: 'Ort. Araç', align: 'right', cell: (d: number) => (wd.agg[d] ? nf1.format(wd.agg[d].adet / wd.agg[d].days) : '—') },
              { key: 'pay', header: 'Pay %', align: 'right', cell: (d: number) => (wd.agg[d] ? nf1.format((wd.agg[d].m3 / wd.totM3) * 100) : '—') },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}
