'use client';

/* Yaşam Döngüsü: riskli müşteriler, büyüme matrisi (YoY segment), yeni/kayıp akışı, ritim, müşteri×bölüm */
import { useMemo, useState } from 'react';
import EChart, { baseChart } from '../EChart';
import { useTheme } from 'next-themes';
import { SectionCard, DataTable, ClsBadge, StatusBadge, DeltaText } from '../Shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CustomerDialog from '../CustomerDialog';
import { useSevkiyat } from '@/lib/sevkiyat/store';
import { custLifeRows, growthRows, flowMonths } from '@/lib/sevkiyat/analytics';
import { SEG_LABEL } from '@/lib/sevkiyat/analytics';
import { nf0, nf1, fmtDate, uniq, ymLabel, pct } from '@/lib/sevkiyat/core';
import { cn } from '@/lib/utils';
import type { Segment } from '@/lib/sevkiyat/types';
import { HeartPulse, Users } from 'lucide-react';

const SEG_TONE: Record<Segment, 'up' | 'dn' | 'mid' | 'neutral'> = {
  buyuyen: 'up',
  kuculen: 'dn',
  yeni: 'up',
  kayip: 'dn',
  stabil: 'mid',
};

const SEG_STATUS: Record<Segment, { label: string; tone: 'ok' | 'watch' | 'risk' | 'mid' | 'up' | 'dn' | 'neutral' }> = {
  buyuyen: { label: 'Büyüyen', tone: 'up' },
  kuculen: { label: 'Küçülen', tone: 'dn' },
  yeni: { label: 'Yeni', tone: 'up' },
  kayip: { label: 'Kayıp', tone: 'dn' },
  stabil: { label: 'Stabil', tone: 'mid' },
};

const LIFE_TONE = { ok: 'ok', watch: 'watch', risk: 'risk', tek: 'neutral' } as const;

export default function YasamView() {
  const { data } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);

  const life = useMemo(() => custLifeRows(data), [data]);
  const list = life.list;
  const clsRank = { A: 0, B: 1, C: 2 };
  const risk = useMemo(
    () => list.filter((o) => o.status === 'risk').sort((a, b) => clsRank[a.cls] - clsRank[b.cls] || (b.gap ?? 0) / (b.eff ?? 1) - (a.gap ?? 0) / (a.eff ?? 1)),
    [list]
  );
  const rhythm = useMemo(
    () => list.filter((o) => o.days >= 2).sort((a, b) => {
      const rank = { risk: 0, watch: 1, ok: 2, tek: 3 } as const;
      return rank[a.status] - rank[b.status] || b.m3 - a.m3;
    }),
    [list]
  );

  const years = useMemo(() => uniq(data.map((r) => r.yil).filter((y): y is number => !!y)).sort((a, b) => b - a), [data]);
  const [gy, setGy] = useState<number | null>(null);
  const growthYear = gy ?? years[0] ?? new Date().getFullYear();
  const growth = useMemo(() => growthRows(data, growthYear), [data, growthYear]);

  const flow = useMemo(() => flowMonths(data, life.ref), [data, life.ref]);
  const flowAsc = flow.slice().reverse().slice(-18);

  const deps = useMemo(() => uniq(data.map((r) => r.bolum)).sort(), [data]);
  const top25 = useMemo(() => list.slice().sort((a, b) => b.m3 - a.m3).slice(0, 25), [list]);
  const [sel, setSel] = useState<string | null>(null);

  if (!data.length) return <div className="text-sm text-muted-foreground py-16 text-center">Veri yüklenmedi.</div>;

  // Segment özet çipleri
  const segChips = (['buyuyen', 'kuculen', 'yeni', 'kayip', 'stabil'] as Segment[]).map((s) => {
    const g = growth.filter((o) => o.seg === s);
    const net = g.reduce((sum, o) => sum + (o.cur - o.pr), 0);
    return { s, n: g.length, net };
  });

  return (
    <div className="space-y-4">
      <SectionCard
        icon={<HeartPulse className="w-4 h-4" />}
        title="🚨 Riskli Müşteriler"
        desc={
          (life.ref ? 'Referans: ' + fmtDate(life.ref) + ' · ' : '') +
          'Ritimde ≤ ort×1,3 · İzle ≤ ×1,8 · üstü Riskli'
        }
      >
        <DataTable
          rows={risk}
          maxHeight={300}
          compact
          clickable
          onRowClick={(o) => setSel(o.name)}
          emptyText="✅ Riskli müşteri yok."
          cols={[
            { key: 'name', header: 'Müşteri', cell: (o) => <b>{o.name}</b> },
            { key: 'cls', header: 'Sınıf', cell: (o) => <ClsBadge cls={o.cls} /> },
            { key: 'loads', header: 'Yükleme', align: 'right', cell: (o) => String(o.loads) },
            { key: 'm3', header: 'm³', align: 'right', cell: (o) => nf1.format(o.m3) },
            { key: 'avg', header: 'Ort. Aralık', align: 'right', cell: (o) => (o.avgInt != null ? '~' + o.avgInt + ' gün' : '—') },
            { key: 'last', header: 'Son', cell: (o) => (o.last ? fmtDate(o.last) : '—') },
            { key: 'gap', header: 'Geçen', align: 'right', cell: (o) => <b className={cn((o.gap ?? 0) > 60 && 'text-red-600 dark:text-red-400')}>{o.gap != null ? o.gap + ' gün' : '—'}</b> },
            { key: 'st', header: 'Durum', cell: (o) => <StatusBadge tone={LIFE_TONE[o.status]} label={{ ok: 'Ritimde', watch: 'İzle', risk: 'Riskli', tek: 'Yeni/Tek' }[o.status]} /> },
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={<HeartPulse className="w-4 h-4" />}
        title="📈 Büyüme Matrisi (YoY)"
        desc="Müşteri bazında yıl kıyası: Büyüyen ≥ +%10 · Küçülen ≤ −%10"
        action={
          years.length ? (
            <Select value={String(growthYear)} onValueChange={(v) => setGy(+v)}>
              <SelectTrigger size="sm" className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {segChips.map(({ s, n, net }) => (
            <span
              key={s}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold ring-1',
                s === 'buyuyen' || s === 'yeni' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25' :
                s === 'kuculen' || s === 'kayip' ? 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/25' :
                'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25'
              )}
            >
              {SEG_LABEL[s]}: {n} · Δ {net >= 0 ? '+' : ''}{nf1.format(net)} m³
            </span>
          ))}
        </div>
        <DataTable
          rows={growth}
          maxHeight={420}
          compact
          clickable
          onRowClick={(o) => setSel(o.name)}
          cols={[
            { key: 'name', header: 'Müşteri', cell: (o) => <b>{o.name}</b> },
            { key: 'cls', header: 'Sınıf', cell: (o) => <ClsBadge cls={o.cls} /> },
            { key: 'seg', header: 'Segment', cell: (o) => <StatusBadge tone={SEG_STATUS[o.seg].tone} label={SEG_LABEL[o.seg]} /> },
            { key: 'pr', header: growthYear - 1 + ' m³', align: 'right', cell: (o) => (o.pr ? nf1.format(o.pr) : <span className="text-border">–</span>) },
            { key: 'cur', header: growthYear + ' m³', align: 'right', cell: (o) => (o.cur ? nf1.format(o.cur) : <span className="text-border">–</span>) },
            { key: 'd', header: 'Δ m³', align: 'right', cell: (o) => <DeltaText v={+(o.cur - o.pr).toFixed(1)} /> },
            { key: 'dp', header: 'Δ %', align: 'right', cell: (o) => (o.delta == null ? '—' : <span className={cn('font-semibold', o.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{pct(o.delta)}</span>) },
            { key: 'prA', header: (growthYear - 1) + ' Ar.', align: 'right', cell: (o) => (o.prA || <span className="text-border">–</span>) },
            { key: 'curA', header: growthYear + ' Ar.', align: 'right', cell: (o) => (o.curA || <span className="text-border">–</span>) },
          ]}
        />
      </SectionCard>

      <SectionCard icon={<HeartPulse className="w-4 h-4" />} title="🆕↩️ Yeni / Kayıp Müşteri Akışı" desc="Yeni: o ay ilk kez yükleyen · Kayıp: 45+ gündür gelmeyen">
        <EChart height={320} option={{
          grid: { left: 44, right: 50, top: 30, bottom: 40 },
          xAxis: { type: 'category', data: flowAsc.map((m) => ymLabel(m.ym)), ...th.axisCommon, axisLabel: { ...th.axisCommon.axisLabel, rotate: 30 } },
          yAxis: [{ type: 'value', ...th.axisCommon, name: 'Yeni(+) / Kayıp(−)' }, { type: 'value', ...th.axisCommon, position: 'right', name: 'Aktif', splitLine: { show: false } }],
          tooltip: { ...th.tooltip, trigger: 'axis' },
          legend: { bottom: 0, textStyle: { color: th.c.muted, fontSize: 11 } },
          series: [
            { name: 'Yeni', type: 'bar', stack: 's', data: flowAsc.map((m) => m.yeni), itemStyle: { color: th.c.palette[1], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 18 },
            { name: 'Kayıp', type: 'bar', stack: 's', data: flowAsc.map((m) => -m.kayip), itemStyle: { color: th.c.palette[4], borderRadius: [0, 0, 4, 4] }, barMaxWidth: 18 },
            { name: 'Aktif', type: 'line', yAxisIndex: 1, data: flowAsc.map((m) => m.aktif), smooth: true, lineStyle: { width: 2.5, color: th.c.palette[0] }, itemStyle: { color: th.c.palette[0] }, symbolSize: 4 },
          ],
        }} />
        <div className="mt-3">
          <DataTable
            rows={flow}
            maxHeight={260}
            compact
            cols={[
              { key: 'ym', header: 'Ay', cell: (m) => <b>{ymLabel(m.ym)}</b> },
              { key: 'yeni', header: '🆕 Yeni', align: 'right', cell: (m) => (m.yeni ? '+' + m.yeni : '—') },
              { key: 'kayip', header: '↩️ Kayıp', align: 'right', cell: (m) => (m.kayip ? '−' + m.kayip : '—') },
              { key: 'aktif', header: 'Aktif', align: 'right', cell: (m) => String(m.aktif) },
              { key: 'net', header: 'Net', align: 'right', cell: (m) => <DeltaText v={m.yeni - m.kayip} /> },
            ]}
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard icon={<HeartPulse className="w-4 h-4" />} title="⏱ Yükleme Ritmi" desc="En az 2 yükleme günü olan müşteriler">
          <DataTable
            rows={rhythm}
            maxHeight={420}
            compact
            clickable
            onRowClick={(o) => setSel(o.name)}
            cols={[
              { key: 'name', header: 'Müşteri', cell: (o) => <b>{o.name}</b> },
              { key: 'cls', header: 'Sınıf', cell: (o) => <ClsBadge cls={o.cls} /> },
              { key: 'loads', header: 'Yükleme', align: 'right', cell: (o) => String(o.loads) },
              { key: 'days', header: 'Gün', align: 'right', cell: (o) => String(o.days) },
              { key: 'first', header: 'İlk', cell: (o) => (o.first ? fmtDate(o.first) : '—') },
              { key: 'last', header: 'Son', cell: (o) => (o.last ? fmtDate(o.last) : '—') },
              { key: 'avg', header: 'Ort. Aralık', align: 'right', cell: (o) => (o.avgInt != null ? '~' + o.avgInt + ' g' : '—') },
              { key: 'gap', header: 'Geçen', align: 'right', cell: (o) => (o.gap != null ? o.gap + ' g' : '—') },
              { key: 'st', header: 'Durum', cell: (o) => <StatusBadge tone={LIFE_TONE[o.status]} label={{ ok: 'Ritimde', watch: 'İzle', risk: 'Riskli', tek: 'Yeni/Tek' }[o.status]} /> },
            ]}
          />
        </SectionCard>

        <SectionCard icon={<Users className="w-4 h-4" />} title="🏭 Müşteri × Bölüm (ilk 25, m³)">
          <DataTable
            rows={top25}
            maxHeight={420}
            compact
            clickable
            onRowClick={(o) => setSel(o.name)}
            cols={[
              { key: 'name', header: 'Müşteri', cell: (o) => <b>{o.name}</b> },
              { key: 'cls', header: 'Sınıf', cell: (o) => <ClsBadge cls={o.cls} /> },
              ...deps.map((d) => ({
                key: 'dep-' + d,
                header: d,
                align: 'right' as const,
                cell: (o: (typeof top25)[number]) => (o.deps[d] ? nf1.format(o.deps[d]) : <span className="text-border">–</span>),
              })),
              { key: 'tot', header: 'Toplam', align: 'right', cell: (o) => <b>{nf1.format(o.m3)}</b> },
            ]}
          />
        </SectionCard>
      </div>

      <CustomerDialog name={sel} rows={data} onClose={() => setSel(null)} />
    </div>
  );
}
