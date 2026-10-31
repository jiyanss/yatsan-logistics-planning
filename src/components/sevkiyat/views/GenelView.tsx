'use client';

/* Genel Grafikler & Matris görünümü */
import { useMemo } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable } from '../Shared';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { groupSum, weeklyAgg, dailyList, matrixData, linreg } from '@/lib/sevkiyat/analytics';
import { uniq, nf0, nf1 } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { BarChart3 } from 'lucide-react';

export default function GenelView({ rows }: { rows: Row[] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);
  void useSevkiyat;

  const dated = useMemo(() => rows.filter((r) => r.tarih), [rows]);
  const deps = useMemo(() => uniq(rows.map((r) => r.bolum)).sort(), [rows]);
  const tips = useMemo(() => uniq(rows.map((r) => r.tip)).sort(), [rows]);
  const gDep = useMemo(() => groupSum(rows, (r) => r.bolum), [rows]);
  const gTip = useMemo(() => groupSum(rows, (r) => r.tip), [rows]);
  const daily = useMemo(() => dailyList(dated), [dated]);
  const weekly = useMemo(() => weeklyAgg(dated).sort((a, b) => a.yil - b.yil || a.hafta - b.hafta), [dated]);
  const matrix = useMemo(() => matrixData(rows), [rows]);

  // 4 haftalık doğrusal regresyon tahmini (son 8 hafta)
  const fc = useMemo(() => {
    if (weekly.length < 4) return { fV: [] as (number | null)[], fM: [] as (number | null)[], labels: [] as string[] };
    const tailV = weekly.slice(-8).map((w) => w.adet);
    const tailM = weekly.slice(-8).map((w) => w.m3);
    const regV = linreg(tailV);
    const regM = linreg(tailM);
    const lastD = dated.map((r) => r.tarih!.getTime());
    const lastDate = new Date(Math.max(...lastD));
    const fV: (number | null)[] = [];
    const fM: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      fV.push(Math.max(0, Math.round(regV(tailV.length + i))));
      fM.push(Math.max(0, Math.round(regM(tailM.length + i))));
    }
    void lastDate;
    return { fV, fM, labels: weekly.map((w) => w.yil + '/H' + w.hafta) };
  }, [weekly, dated]);

  const wc = {
    grid: { left: 46, right: 54, top: 30, bottom: 46 },
    xAxis: { type: 'category', data: fc.labels, ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, interval: Math.max(0, Math.floor(fc.labels.length / 12)), rotate: 24 } },
    yAxis: [
      { type: 'value', ...th.axisCommon, name: 'Araç' },
      { type: 'value', ...th.axisCommon, position: 'right', name: 'm³', splitLine: { show: false } },
    ],
    tooltip: { ...th.tooltip, trigger: 'axis' },
    legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 }, itemWidth: 14 },
    series: [
      {
        name: 'Araç', type: 'line', yAxisIndex: 0, data: weekly.map((w) => w.adet), smooth: 0.35, symbolSize: 4,
        lineStyle: { width: 2.5, color: th.c.palette[0] }, itemStyle: { color: th.c.palette[0] },
        areaStyle: { color: dark ? 'rgba(56,189,248,.12)' : 'rgba(2,132,199,.08)' },
      },
      {
        name: 'm³', type: 'line', yAxisIndex: 1, data: weekly.map((w) => +w.m3.toFixed(1)), smooth: 0.35, symbolSize: 4,
        lineStyle: { width: 2, color: th.c.palette[1] }, itemStyle: { color: th.c.palette[1] },
      },
      {
        name: 'Araç Tahmin *', type: 'line', yAxisIndex: 0,
        data: [...weekly.map(() => null), ...fc.fV],
        smooth: 0.35, lineStyle: { width: 2, type: 'dashed' as const, color: th.c.palette[0] },
        itemStyle: { color: th.c.palette[0] },
      },
      {
        name: 'm³ Tahmin *', type: 'line', yAxisIndex: 1,
        data: [...weekly.map(() => null), ...fc.fM],
        smooth: 0.35, lineStyle: { width: 1.5, type: 'dashed' as const, color: th.c.palette[1] },
        itemStyle: { color: th.c.palette[1] },
      },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={<BarChart3 className="w-4 h-4" />} title="🏭 Bölümlere Göre Yükleme" desc="Araç sayısı (bar) ve m³ (çizgi)">
          <EChart height={300} option={{
            grid: { left: 48, right: 52, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: deps, ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, interval: 0, rotate: deps.length > 6 ? 24 : 0 } },
            yAxis: [{ type: 'value', ...th.axisCommon, name: 'Araç' }, { type: 'value', ...th.axisCommon, position: 'right', name: 'm³', splitLine: { show: false } }],
            tooltip: { ...th.tooltip, trigger: 'axis' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
            series: [
              { name: 'Araç', type: 'bar', data: deps.map((d) => gDep.get(d)?.adet ?? 0), itemStyle: { color: th.c.palette[0], borderRadius: [6, 6, 0, 0] }, barMaxWidth: 34 },
              { name: 'm³', type: 'line', yAxisIndex: 1, data: deps.map((d) => +(gDep.get(d)?.m3 ?? 0).toFixed(1)), smooth: true, lineStyle: { width: 2.5, color: th.c.palette[1] }, itemStyle: { color: th.c.palette[1] } },
            ],
          }} />
        </SectionCard>

        <SectionCard icon={<BarChart3 className="w-4 h-4" />} title="🚛 Sevkiyat Tipi Dağılımı" desc="Araç payı (halka grafik)">
          <EChart height={300} option={{
            tooltip: { ...th.tooltip, trigger: 'item', formatter: '{b}: {c} araç ({d}%)' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 }, type: 'scroll' },
            series: [{
              type: 'pie', radius: ['46%', '72%'], center: ['50%', '44%'],
              data: tips.map((t, i) => ({ name: t, value: gTip.get(t)?.adet ?? 0, itemStyle: { color: th.c.palette[i % th.c.palette.length] } })),
              borderWidth: 2, borderColor: dark ? '#16223a' : '#ffffff',
              label: { color: th.c.muted, fontSize: 11, formatter: '{b}\n{d}%' },
              itemStyle: { borderRadius: 6 },
            }],
          }} />
        </SectionCard>

        <SectionCard icon={<BarChart3 className="w-4 h-4" />} title="📈 Günlük Trend" desc="Gün bazında araç ve m³">
          <EChart height={300} option={{
            grid: { left: 48, right: 16, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: daily.map((d) => d.k), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, interval: Math.max(0, Math.floor(daily.length / 10)), rotate: 30 } },
            yAxis: [{ type: 'value', ...th.axisCommon, name: 'Araç' }, { type: 'value', ...th.axisCommon, position: 'right', name: 'm³', splitLine: { show: false } }],
            tooltip: { ...th.tooltip, trigger: 'axis' },
            legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
            dataZoom: daily.length > 60 ? [{ type: 'slider', height: 16, bottom: 4 }] : [],
            series: [
              { name: 'Araç', type: 'line', data: daily.map((d) => d.adet), smooth: true, symbol: 'none', lineStyle: { width: 2, color: th.c.palette[0] }, areaStyle: { color: dark ? 'rgba(56,189,248,.14)' : 'rgba(2,132,199,.1)' } },
              { name: 'm³', type: 'line', yAxisIndex: 1, data: daily.map((d) => +d.m3.toFixed(1)), smooth: true, symbol: 'none', lineStyle: { width: 1.6, color: th.c.palette[1] } },
            ],
          }} />
        </SectionCard>

        <SectionCard icon={<BarChart3 className="w-4 h-4" />} title="📅 Haftalık + Tahmin" desc="Kesikli çizgiler: son 8 haftanın doğrusal regresyonu ile 4 haftalık tahmin (*)">
          <EChart height={300} option={wc} />
        </SectionCard>
      </div>

      <SectionCard
        icon={<BarChart3 className="w-4 h-4" />}
        title="📌 Bölüm × Sevkiyat Tipi Matrisi"
        desc="Her hücre: araç sayısı ve m³"
      >
        <DataTable
          rows={matrix.deps}
          maxHeight={420}
          emptyText="Veri yok"
          cols={[
            { key: 'dep', header: 'Bölüm', cell: (d) => <b>{d}</b> },
            ...matrix.tips.map((t) => ({
              key: 'tip-' + t,
              header: t,
              cell: (d: string) => {
                const c = matrix.cell[d + '|' + t];
                return c ? (
                  <div className="leading-tight">
                    <b className="tabular-nums">{nf0.format(c.adet)}</b> araç
                    <div className="text-[10.5px] text-muted-foreground tabular-nums">{nf1.format(c.m3)} m³</div>
                  </div>
                ) : <span className="text-border">–</span>;
              },
            })),
            {
              key: 'tot', header: 'Toplam',
              cell: (d: string) => {
                const t = matrix.tips.reduce((s, t2) => s + (matrix.cell[d + '|' + t2]?.adet ?? 0), 0);
                const m = matrix.tips.reduce((s, t2) => s + (matrix.cell[d + '|' + t2]?.m3 ?? 0), 0);
                return <div className="leading-tight bg-amber-500/8 -mx-2.5 px-2.5 py-1 rounded"><b className="tabular-nums">{nf0.format(t)}</b> araç<div className="text-[10.5px] text-muted-foreground tabular-nums">{nf1.format(m)} m³</div></div>;
              },
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}
