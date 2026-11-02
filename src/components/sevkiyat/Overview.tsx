'use client';

/* Genel Bakış: KPI şeridi + akıllı uyarılar + özet tile'ları (mini grafikler) */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Truck, Boxes, Gauge, Users, CalendarDays, CalendarClock, ArrowUpRight, ArrowDownRight, TriangleAlert, CircleCheck } from 'lucide-react';
import EChart, { baseChart } from './EChart';
import { useTheme } from 'next-themes';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { collectAlerts } from '@/lib/sevkiyat/alerts';
import { weeklyAgg, monthlyAgg, groupSum, custAgg, custLifeRows } from '@/lib/sevkiyat/analytics';
import { ymLabel, nf0, nf1, fmtDate, maxDate } from '@/lib/sevkiyat/core';
import { cn } from '@/lib/utils';
import type { ViewId } from '@/lib/sevkiyat/types';

export default function Overview() {
  const { data, filters, targets, setView } = useSevkiyat();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const th = baseChart(dark);

  const rows = useMemo(() => applyFilters(data, filters), [data, filters]);

  const kpi = useMemo(() => {
    const adet = rows.reduce((s, r) => s + r.adet, 0);
    const m3 = rows.reduce((s, r) => s + r.m3, 0);
    const custs = new Set(rows.map((r) => r.musteri)).size;
    const days = new Set(rows.filter((r) => r.tarih).map((r) => r.tarihStr)).size;
    const last = maxDate(rows);
    return { adet, m3, avg: adet ? m3 / adet : 0, custs, days, last };
  }, [rows]);

  const alerts = useMemo(() => collectAlerts(data, targets), [data, targets]);

  // Mini grafik verileri
  const weekly = useMemo(() => weeklyAgg(rows.filter((r) => r.tarih)).sort((a, b) => a.yil - b.yil || a.hafta - b.hafta).slice(-12), [rows]);
  const monthly = useMemo(() => monthlyAgg(rows).slice(-12), [rows]);
  const depAgg = useMemo(() => Array.from(groupSum(rows, (r) => r.bolum).entries()).sort((a, b) => b[1].adet - a[1].adet), [rows]);
  const tipAgg = useMemo(() => Array.from(groupSum(rows, (r) => r.tip).entries()).sort((a, b) => b[1].adet - a[1].adet), [rows]);
  const custs = useMemo(() => custAgg(rows), [rows]);
  const life = useMemo(() => custLifeRows(data), [data]);

  // Hedef (son tarihin ayı)
  const refD = maxDate(rows);
  const ym = refD ? refD.getFullYear() + '-' + String(refD.getMonth() + 1).padStart(2, '0') : null;
  const tgt = ym ? targets[ym] : undefined;
  const monthRows = useMemo(() => (ym ? data.filter((r) => r.tarih && r.tarih.getFullYear() + '-' + String(r.tarih.getMonth() + 1).padStart(2, '0') === ym) : []), [data, ym]);
  const mAdet = monthRows.reduce((s, r) => s + r.adet, 0);
  const mM3 = monthRows.reduce((s, r) => s + r.m3, 0);

  if (!data.length) return null;

  const wTotal = weekly.reduce((s, w) => s + w.adet, 0);
  const mTotal = monthly.reduce((s, m) => s + m.adet, 0);
  const nRisk = life.list.filter((o) => o.status === 'risk').length;
  const nWatch = life.list.filter((o) => o.status === 'watch').length;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI şeridi */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={<Truck className="w-4.5 h-4.5" />} grad="from-sky-500 to-cyan-500" label="Araç" value={nf0.format(kpi.adet)} />
        <Kpi icon={<Boxes className="w-4.5 h-4.5" />} grad="from-emerald-500 to-teal-500" label="Toplam m³" value={nf1.format(kpi.m3)} />
        <Kpi icon={<Gauge className="w-4.5 h-4.5" />} grad="from-amber-500 to-orange-500" label="m³ / Araç" value={nf1.format(kpi.avg)} />
        <Kpi icon={<Users className="w-4.5 h-4.5" />} grad="from-violet-500 to-purple-500" label="Müşteri" value={nf0.format(kpi.custs)} />
        <Kpi icon={<CalendarDays className="w-4.5 h-4.5" />} grad="from-cyan-500 to-sky-600" label="Yükleme Günü" value={nf0.format(kpi.days)} />
        <Kpi icon={<CalendarClock className="w-4.5 h-4.5" />} grad="from-slate-500 to-slate-600" label="Son Yükleme" value={kpi.last ? fmtDate(kpi.last) : '—'} />
      </div>

      {/* Uyarılar */}
      <Card className={cn('shadow-sm border', alerts.some((a) => a.lvl === 'err') ? 'border-red-500/30' : 'border-border/70')}>
        <CardContent className="p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <TriangleAlert className={cn('w-4 h-4', alerts.some((a) => a.lvl === 'err') ? 'text-red-500' : 'text-muted-foreground')} />
            <span className="font-semibold text-[13.5px]">Akıllı Uyarılar</span>
            {alerts.length === 0 && data.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-600 dark:text-emerald-400 ml-1">
                <CircleCheck className="w-3.5 h-3.5" /> aktif uyarı yok
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {data.length === 0 && <div className="text-xs text-muted-foreground">Veri yüklenince uyarılar görünür.</div>}
            {alerts.slice(0, 4).map((a, i) => (
              <button
                key={i}
                onClick={() => setView(a.view)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12.5px] border-l-4 transition-colors cursor-pointer',
                  a.lvl === 'err' ? 'bg-red-500/8 border-red-500 hover:bg-red-500/15' :
                  a.lvl === 'warn' ? 'bg-amber-500/8 border-amber-500 hover:bg-amber-500/15' :
                  'bg-emerald-500/8 border-emerald-500 hover:bg-emerald-500/15'
                )}
              >
                <span className={cn(a.lvl === 'err' ? 'text-red-700 dark:text-red-300' : a.lvl === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>
                  {a.txt}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tile ızgarası */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Tile wide onClick={() => setView('genel')} title="Haftalık Trend" go="genel">
          <div className="text-xl font-extrabold tracking-tight">{nf0.format(wTotal)} <span className="text-xs font-semibold text-muted-foreground">araç · son {weekly.length} hafta</span></div>
          <div className="text-[11px] text-muted-foreground">{nf1.format(weekly.reduce((s, w) => s + w.m3, 0))} m³</div>
          <MiniHeight>
            <EChart height={74} option={{
              grid: { left: 0, right: 0, top: 4, bottom: 0 },
              xAxis: { type: 'category', data: weekly.map((w) => 'H' + w.hafta), show: false },
              yAxis: { type: 'value', show: false },
              series: [{
                type: 'line', data: weekly.map((w) => w.adet), smooth: 0.4, symbol: 'none',
                lineStyle: { width: 2.5, color: '#0891b2' },
                areaStyle: { color: dark ? 'rgba(34,211,238,.18)' : 'rgba(8,145,178,.12)' },
              }],
              tooltip: { ...th.tooltip, trigger: 'axis' },
            }} />
          </MiniHeight>
        </Tile>

        <Tile onClick={() => setView('genel')} title="Bölümler" go="genel">
          <div className="text-xl font-extrabold tracking-tight">{depAgg.length ? nf0.format(depAgg.reduce((s, e) => s + e[1].adet, 0)) + ' araç' : '—'}</div>
          <div className="text-[11px] text-muted-foreground truncate">{depAgg.slice(0, 3).map((e) => e[0]).join(' · ') || 'veri yok'}</div>
          <MiniHeight>
            <EChart height={74} option={{
              grid: { left: 0, right: 0, top: 4, bottom: 0 },
              xAxis: { type: 'category', data: depAgg.slice(0, 6).map((e) => e[0]), show: false },
              yAxis: { type: 'value', show: false },
              series: [{ type: 'bar', data: depAgg.slice(0, 6).map((e) => e[1].adet), itemStyle: { color: dark ? '#38bdf8' : '#0284c7', borderRadius: 3 }, barWidth: '55%' }],
              tooltip: { ...th.tooltip, trigger: 'axis' },
            }} />
          </MiniHeight>
        </Tile>

        <Tile onClick={() => setView('genel')} title="Sevkiyat Tipleri" go="genel">
          <div className="text-xl font-extrabold tracking-tight">{tipAgg.length ? nf0.format(tipAgg.reduce((s, e) => s + e[1].adet, 0)) + ' araç' : '—'}</div>
          <div className="text-[11px] text-muted-foreground truncate">{tipAgg.slice(0, 2).map((e) => e[0] + ' ' + e[1].adet).join(' · ') || 'veri yok'}</div>
          <MiniHeight>
            <EChart height={74} option={{
              series: [{
                type: 'pie', radius: ['58%', '80%'], center: ['50%', '50%'],
                data: tipAgg.map((e, i) => ({ name: e[0], value: e[1].adet, itemStyle: { color: th.c.palette[i % th.c.palette.length] } })),
                label: { show: false }, silent: true, borderWidth: 2, borderColor: dark ? '#111a2c' : '#ffffff',
              }],
              tooltip: { ...th.tooltip },
            }} />
          </MiniHeight>
        </Tile>

        <Tile wide onClick={() => setView('aylik')} title="Aylık Trend" go="aylik">
          <div className="text-xl font-extrabold tracking-tight">{nf0.format(mTotal)} <span className="text-xs font-semibold text-muted-foreground">araç · son {monthly.length} ay</span></div>
          <div className="text-[11px] text-muted-foreground">{monthly.length ? ymLabel(monthly[0].ym) + ' – ' + ymLabel(monthly[monthly.length - 1].ym) : 'veri yok'}</div>
          <MiniHeight>
            <EChart height={74} option={{
              grid: { left: 0, right: 0, top: 4, bottom: 0 },
              xAxis: { type: 'category', data: monthly.map((m) => ymLabel(m.ym)), show: false },
              yAxis: { type: 'value', show: false },
              series: [{
                type: 'line', data: monthly.map((m) => m.adet), smooth: 0.4, symbol: 'none',
                lineStyle: { width: 2.5, color: '#7c3aed' },
                areaStyle: { color: dark ? 'rgba(167,139,250,.18)' : 'rgba(124,58,237,.12)' },
              }],
              tooltip: { ...th.tooltip, trigger: 'axis' },
            }} />
          </MiniHeight>
        </Tile>

        <Tile onClick={() => setView('hedef')} title="Bu Ay Hedef" go="hedef">
          {tgt && (tgt.adet || tgt.m3) ? (
            <>
              <div className="text-xl font-extrabold tracking-tight">{tgt.adet ? nf0.format(mAdet) + ' / ' + nf0.format(tgt.adet) : '—'}</div>
              <div className="text-[11px] text-muted-foreground">{ym ? ymLabel(ym) : ''} · araç</div>
              <BarMeter label="Araç" p={tgt.adet ? (mAdet / tgt.adet) * 100 : 0} color="#0284c7" />
              {tgt.m3 ? <BarMeter label="m³" p={(mM3 / tgt.m3) * 100} color="#d97706" sub={nf1.format(mM3) + ' / ' + nf1.format(tgt.m3)} /> : null}
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">Bu ay için hedef girilmemiş — Hedefler bölümünden ekleyin.</div>
          )}
        </Tile>

        <Tile onClick={() => setView('mus')} title="Müşteriler (ABC)" go="mus">
          <div className="text-xl font-extrabold tracking-tight">{custs.length}</div>
          <div className="text-[11px] text-muted-foreground truncate">En büyük: {custs[0]?.name.slice(0, 20) || '—'}</div>
          <div className="flex gap-1.5 mt-auto pt-1.5 flex-wrap">
            {['A', 'B', 'C'].map((c) => (
              <span key={c} className={cn('rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ring-1',
                c === 'A' ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25' :
                c === 'B' ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25' :
                'bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25')}>
                {c}: {custs.filter((x) => x.cls === c).length}
              </span>
            ))}
          </div>
        </Tile>

        <Tile onClick={() => setView('yasam')} title="Yaşam Döngüsü" go="yasam">
          <div className={cn('text-xl font-extrabold tracking-tight', nRisk > 0 && 'text-red-600 dark:text-red-400')}>
            {nRisk > 0 ? nRisk + ' riskli' : '✓ 0 riskli'}
          </div>
          <div className="text-[11px] text-muted-foreground">{life.list.length} müşteri analiz edildi</div>
          <div className="flex gap-1.5 mt-auto pt-1.5 flex-wrap">
            <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ring-1 bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25">Riskli {nRisk}</span>
            <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ring-1 bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25">İzle {nWatch}</span>
            <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ring-1 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25">Ritimde {life.list.length - nRisk - nWatch}</span>
          </div>
        </Tile>

        <Tile onClick={() => setView('rapor')} title="Detay Raporlar" go="rapor">
          <div className="text-xl font-extrabold tracking-tight">10 sayfa</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Haftalık & günlük özet<br />Bölüm × tip matrisi<br />Müşteri ABC & büyüme
          </div>
          <div className="mt-auto pt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
            Excel olarak indir <ArrowDownRight className="w-3 h-3" />
          </div>
        </Tile>
      </div>
    </div>
  );
}

function Kpi({ icon, grad, label, value }: { icon: React.ReactNode; grad: string; label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 flex items-center gap-2.5">
        <span className={cn('w-9 h-9 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shrink-0 shadow-sm', grad)}>{icon}</span>
        <div className="min-w-0">
          <div className="text-[17px] font-extrabold leading-tight tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({ title, children, onClick, wide, go }: { title: string; children: React.ReactNode; onClick: () => void; wide?: boolean; go: ViewId }) {
  void go;
  return (
    <Card
      onClick={onClick}
      className={cn('shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/40 hover:-translate-y-0.5 transition-all group', wide && 'md:col-span-2')}
    >
      <CardContent className="p-3.5 flex flex-col gap-1.5 h-full">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{title}</span>
          <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function MiniHeight({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5">{children}</div>;
}

function BarMeter({ label, p, color, sub }: { label: string; p: number; color: string; sub?: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span className="tabular-nums">{nf0.format(Math.min(100, p))}%{sub ? ' · ' + sub : ''}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full" style={{ width: Math.min(100, p) + '%', background: color }} />
      </div>
    </div>
  );
}
