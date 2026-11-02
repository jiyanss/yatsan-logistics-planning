'use client';

/* Yönetim Raporları — grafik ağırlıklı, PDF çıktılı 3 modül:
   1 · Yönetici Özeti   2 · Lojistik & Filo   3 · Müşteri Performansı
   Rapor yüzeyi bilinçli olarak sabit açık tema ("kağıt") kullanır; böylece
   PDF çıktısı her tema tutarlı ve baskı dostu olur. Eksen/renk paleti de
   her zaman açık tema paletidir. */
import { useMemo, useState } from 'react';
import EChart, { baseChart, chartColors } from '../EChart';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileDown, Loader2, Boxes, Truck, Users, Scale } from 'lucide-react';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import {
  raporKPI, aylikTrend, yillikTrend, bolumPaylari, tipDagilimi,
  gunYogunlugu, isiHaritasi, topMusteriler,
} from '@/lib/sevkiyat/reports';
import { nf0, nf1 } from '@/lib/sevkiyat/core';
import { elemanPdf, pdfDosyaAdi } from '@/lib/sevkiyat/pdfExport';
import { toast } from '@/hooks/use-toast';
import { EmptyState } from '../Shared';
import { FileBarChart } from 'lucide-react';
import type { EChartsCoreOption } from 'echarts';
import type { Row } from '@/lib/sevkiyat/types';

type Renk = 'violet' | 'amber' | 'emerald' | 'pink';

export default function YonetimRaporlari() {
  const { data, filters } = useSevkiyat();
  const rows: Row[] = useMemo(() => applyFilters(data, filters), [data, filters]);

  const [trendMod, setTrendMod] = useState<'aylik' | 'yillik'>('aylik');
  const [busy, setBusy] = useState<string | null>(null);

  const kpi = useMemo(() => raporKPI(rows), [rows]);
  const trend = useMemo(
    () => (trendMod === 'aylik' ? aylikTrend(rows) : yillikTrend(rows)),
    [rows, trendMod]
  );
  const bolum = useMemo(() => bolumPaylari(rows), [rows]);
  const tipler = useMemo(() => tipDagilimi(rows, 8), [rows]);
  const gunler = useMemo(() => gunYogunlugu(rows), [rows]);
  const isi = useMemo(() => isiHaritasi(rows), [rows]);
  const top10 = useMemo(() => topMusteriler(rows, 10), [rows]);
  const top8 = useMemo(() => topMusteriler(rows, 8), [rows]);

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <EmptyState
          icon={<FileBarChart className="w-6 h-6" />}
          title="Rapor için veri yok"
          desc="Aktif filtreler tüm kayıtları eliyor. Filtreleri gevşetin veya Excel Yükleme bölümünden veri yükleyin."
        />
      </div>
    );
  }

  const pdfIndir = async (id: string, ad: string) => {
    setBusy(id);
    try {
      const ok = await elemanPdf(document.getElementById(id), pdfDosyaAdi(ad));
      toast({
        title: ok ? 'PDF indirildi' : 'PDF oluşturulamadı',
        description: ok ? ad + ' raporu kaydedildi' : 'Rapor bölümü bulunamadı',
        variant: ok ? undefined : 'destructive',
      });
    } catch {
      toast({ title: 'PDF oluşturulamadı', description: 'Sayfayı yenileyip tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground no-pdf">
        <span>
          Raporlar aktif filtreleri takip eder — şu an <b className="text-foreground">{nf0.format(rows.length)}</b> kayıt kapsam içinde.
        </span>
        <span>PDF çıktısı A4 dikey, baskı dostu açık temadır.</span>
      </div>

      <Tabs defaultValue="m1" className="w-full">
        <TabsList className="mb-4 h-auto flex-wrap no-pdf">
          <TabsTrigger value="m1" className="gap-1.5">1 · Yönetici Özeti</TabsTrigger>
          <TabsTrigger value="m2" className="gap-1.5">2 · Lojistik &amp; Filo</TabsTrigger>
          <TabsTrigger value="m3" className="gap-1.5">3 · Müşteri Performansı</TabsTrigger>
        </TabsList>

        {/* ============ MODÜL 1 ============ */}
        <TabsContent value="m1" className="mt-0">
          <Modul
            id="yrapor-m1"
            baslik="Modül 1 · Üst Yönetim Özet Dashboard"
            aciklama="Temel performans göstergeleri, yıllık/aylık trend ve ihracat bölüm payları"
            busy={busy === 'yrapor-m1'}
            onPdf={() => void pdfIndir('yrapor-m1', 'Yonetim-Ozeti')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <KpiKart label="Toplam Yüklenen Hacim" deger={nf1.format(kpi.toplamM3)} birim="m³"
                alt={nf0.format(kpi.seferSayisi) + ' sefer kaydı'} renk="violet" ikon={<Boxes className="w-5 h-5" />} />
              <KpiKart label="Ekipman / Konteyner" deger={nf0.format(kpi.toplamAdet)} birim="adet"
                alt="tüm ekipman tipleri" renk="amber" ikon={<Truck className="w-5 h-5" />} />
              <KpiKart label="Aktif Müşteri" deger={nf0.format(kpi.musteriSayisi)} birim="müşteri"
                alt="benzersiz müşteri sayısı" renk="emerald" ikon={<Users className="w-5 h-5" />} />
              <KpiKart label="Ort. Sefer Başı Hacim" deger={nf1.format(kpi.ortSeferM3)} birim="m³/sefer"
                alt="hacim / sefer kaydı" renk="pink" ikon={<Scale className="w-5 h-5" />} />
            </div>

            <GrafikKarti no={1} baslik="Yıllık / Aylık Sevkiyat Trendi" desc="Büyüme ve sezonsallık analizi — hacim (m³) ve araç adedi"
              saga={
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-semibold no-pdf">
                  {(['aylik', 'yillik'] as const).map((m) => (
                    <button key={m} onClick={() => setTrendMod(m)}
                      className={trendMod === m
                        ? 'px-2.5 py-1 bg-violet-600 text-white transition-colors cursor-pointer'
                        : 'px-2.5 py-1 bg-white text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer'}>
                      {m === 'aylik' ? 'Aylık' : 'Yıllık'}
                    </button>
                  ))}
                </div>
              }>
              <EChart option={trendOption(trend, trendMod)} height={330} />
            </GrafikKarti>

            <GrafikKarti no={2} baslik="İhracat Bölüm Payları" desc="EXPORT bölümlerinin toplam hacim içindeki payı (m³)">
              <EChart option={donutOption(bolum, kpi.toplamM3)} height={320} />
            </GrafikKarti>
          </Modul>
        </TabsContent>

        {/* ============ MODÜL 2 ============ */}
        <TabsContent value="m2" className="mt-0">
          <Modul
            id="yrapor-m2"
            baslik="Modül 2 · Sevkiyat Tipi ve Ekipman Analizi"
            aciklama="Filo kullanımı, sevkiyat tipi dağılımı ve günlük operasyon yoğunluğu"
            busy={busy === 'yrapor-m2'}
            onPdf={() => void pdfIndir('yrapor-m2', 'Lojistik-Filo')}
          >
            <GrafikKarti no={3} baslik="Sevkiyat Tipi Hacim Dağılımı" desc="Komple TIR, 40 HC, Parsiyel TIR, 20 DC gibi tiplerin m³ kullanımı">
              <EChart option={tipBarOption(tipler)} height={320} />
            </GrafikKarti>

            <GrafikKarti no={4} baslik="Günlük Operasyon Yoğunluğu" desc="Yüklemelerin haftanın günlerine göre dağılımı (gün başına ortalama)">
              <EChart option={gunOption(gunler)} height={290} />
            </GrafikKarti>

            <GrafikKarti baslik="Ay × Gün Yoğunluk Isı Haritası" desc="Her hücre ilgili ay ve haftanın günündeki toplam m³ — yoğunluk koyu mor">
              <EChart option={isiOption(isi)} height={Math.min(Math.max(220, isi.ymler.length * 30 + 90), 620)} />
            </GrafikKarti>
          </Modul>
        </TabsContent>

        {/* ============ MODÜL 3 ============ */}
        <TabsContent value="m3" className="mt-0">
          <Modul
            id="yrapor-m3"
            baslik="Modül 3 · Müşteri Performansı"
            aciklama="Hacim liderleri ve ekipman tercih matrisi"
            busy={busy === 'yrapor-m3'}
            onPdf={() => void pdfIndir('yrapor-m3', 'Musteri-Performansi')}
          >
            <GrafikKarti no={5} baslik="Top 10 Müşteri" desc="En yüksek hacme sahip 10 müşteri (m³ ve toplam içindeki payı)">
              <EChart option={top10Option(top10)} height={360} />
            </GrafikKarti>

            <GrafikKarti no={6} baslik="Müşteri Tercih Matrisi" desc="Ana müşterilerin ekipman tercihi: Komple TIR · Parsiyel TIR · Konteyner (m³, yığınlı)">
              <EChart option={matrisOption(top8)} height={340} />
            </GrafikKarti>
          </Modul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ================= yardımcı bileşenler ================= */

function Modul({ id, baslik, aciklama, busy, onPdf, children }: {
  id: string; baslik: string; aciklama: string; busy: boolean; onPdf: () => void; children: React.ReactNode;
}) {
  return (
    <div id={id} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="text-[15px] font-extrabold text-slate-900">{baslik}</div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">{aciklama}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" onClick={onPdf} disabled={busy}
            className="bg-violet-600 hover:bg-violet-700 text-white no-pdf">
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
            PDF indir
          </Button>
          <span className="text-[9.5px] text-slate-400">YATSAN İhracat Yükleme Paneli</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function KpiKart({ label, deger, birim, alt, renk, ikon }: {
  label: string; deger: string; birim: string; alt: string; renk: Renk; ikon: React.ReactNode;
}) {
  const r: Record<Renk, string> = {
    violet: 'from-violet-500 to-fuchsia-500 shadow-violet-500/25',
    amber: 'from-amber-400 to-orange-500 shadow-amber-500/25',
    emerald: 'from-emerald-500 to-teal-500 shadow-emerald-500/25',
    pink: 'from-pink-500 to-rose-500 shadow-pink-500/25',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
      <div className={'w-11 h-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg shrink-0 ' + r[renk]}>
        {ikon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-xl font-extrabold text-slate-900 leading-tight truncate">
          {deger}<span className="text-[12px] font-semibold text-slate-500 ml-1">{birim}</span>
        </div>
        <div className="text-[10.5px] text-slate-500 mt-0.5">{alt}</div>
      </div>
    </div>
  );
}

function GrafikKarti({ no, baslik, desc, saga, children }: {
  no?: number; baslik: string; desc?: string; saga?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-[13px] font-bold text-slate-800">
            {no != null && <span className="text-violet-600">Grafik {no} · </span>}{baslik}
          </div>
          {desc && <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div>}
        </div>
        {saga}
      </div>
      {children}
    </div>
  );
}

/* ================= grafik seçenekleri (sabit açık tema) ================= */

type P = { name: string; value: number; percent: number; dataIndex: number };

function trendOption(trend: { etiket: string; m3: number; adet: number }[], mod: 'aylik' | 'yillik'): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis' },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 } },
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', boundaryGap: false,
      data: trend.map((t) => t.etiket),
      axisLabel: { color: c.muted, fontSize: 10.5, rotate: mod === 'aylik' ? 40 : 0 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
      { type: 'value', name: 'Araç', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Hacim (m³)', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
        data: trend.map((t) => t.m3),
        lineStyle: { width: 2.5, color: c.palette[0] }, itemStyle: { color: c.palette[0] },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(124,58,237,.28)' }, { offset: 1, color: 'rgba(124,58,237,.02)' }] } },
      },
      {
        name: 'Araç Adedi', type: 'line', smooth: true, yAxisIndex: 1, symbol: 'none',
        data: trend.map((t) => t.adet),
        lineStyle: { width: 2, color: c.palette[1], type: 'dashed' }, itemStyle: { color: c.palette[1] },
      },
    ],
  };
}

function donutOption(bolum: { ad: string; m3: number; pay: number }[], toplamM3: number): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: {
      ...b.tooltip, trigger: 'item',
      formatter: (p: P) => p.name + '<br/>' + nf1.format(p.value) + ' m³ · %' + p.percent.toFixed(1),
    },
    legend: { bottom: 0, icon: 'circle', textStyle: { color: c.muted, fontSize: 11 } },
    title: {
      text: nf1.format(toplamM3), subtext: 'toplam m³', left: 'center', top: '36%',
      textStyle: { fontSize: 21, fontWeight: 'bold', color: '#1e1b2e' },
      subtextStyle: { fontSize: 11, color: c.muted },
    },
    series: [{
      type: 'pie', radius: ['52%', '74%'], center: ['50%', '44%'], avoidLabelOverlap: true,
      itemStyle: { borderRadius: 8, borderColor: '#ffffff', borderWidth: 2 },
      label: { color: c.muted, fontSize: 11, formatter: (p: P) => p.name + '\n%' + p.percent.toFixed(1) },
      labelLine: { lineStyle: { color: c.axis } },
      data: bolum.map((d, i) => ({ name: d.ad, value: +d.m3.toFixed(1), itemStyle: { color: c.palette[i % c.palette.length] } })),
    }],
  };
}

function tipBarOption(tipler: { ad: string; m3: number; adet: number; pay: number }[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: {
      ...b.tooltip, trigger: 'axis',
      formatter: (ps: P[]) => {
        const p = ps[0]; const t = tipler[p.dataIndex];
        return '<b>' + p.name + '</b><br/>' + nf1.format(t.m3) + ' m³ · ' + nf0.format(t.adet) + ' adet · %' + t.pay.toFixed(1);
      },
    },
    grid: { left: 6, right: 6, top: 30, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: tipler.map((t) => t.ad),
      axisLabel: { color: c.muted, fontSize: 10.5, rotate: 20, interval: 0 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    series: [{
      type: 'bar', barMaxWidth: 46,
      data: tipler.map((t, i) => ({ value: +t.m3.toFixed(1), itemStyle: { color: c.palette[i % c.palette.length], borderRadius: [6, 6, 0, 0] } })),
      label: { show: true, position: 'top', color: c.muted, fontSize: 10, formatter: (p: P) => nf0.format(p.value) },
    }],
  };
}

function gunOption(g: { gunler: string[]; ortM3: number[]; ortAdet: number[] }): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis' },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 } },
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: g.gunler,
      axisLabel: { color: c.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', name: 'm³ / gün', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitLine: { lineStyle: { color: c.split } } },
      { type: 'value', name: 'araç / gün', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Ort. günlük m³', type: 'bar', barMaxWidth: 40,
        data: g.ortM3.map((v) => ({ value: v, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#a78bfa' }, { offset: 1, color: '#7c3aed' }] }, borderRadius: [6, 6, 0, 0] } })),
      },
      {
        name: 'Ort. günlük araç', type: 'line', smooth: true, yAxisIndex: 1, symbol: 'circle', symbolSize: 5,
        data: g.ortAdet, lineStyle: { width: 2, color: c.palette[1] }, itemStyle: { color: c.palette[1] },
      },
    ],
  };
}

function isiOption(isi: { ymler: string[]; hucreler: { ym: string; gun: number; m3: number }[]; max: number }): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  const gunAd = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const ymler = isi.ymler.slice(-24);
  const yIdx = new Map(ymler.map((y, i) => [y, i] as const));
  const data: [number, number, number][] = [];
  isi.hucreler.forEach((h) => {
    const yi = yIdx.get(h.ym);
    if (yi != null) data.push([h.gun, yi, h.m3]);
  });
  return {
    textStyle: b.textStyle,
    tooltip: {
      ...b.tooltip,
      formatter: (p: { value: [number, number, number] }) => {
        const v = p.value;
        return ymler[v[1]] + ' · ' + gunAd[v[0]] + '<br/><b>' + nf1.format(v[2]) + ' m³</b>';
      },
    },
    grid: { left: 6, right: 10, top: 8, bottom: 44, containLabel: true },
    xAxis: { type: 'category', data: gunAd, splitArea: { show: true }, axisLabel: { color: c.muted, fontSize: 10.5 }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'category', data: ymler, axisLabel: { color: c.muted, fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: {
      min: 0, max: isi.max || 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#3b0764'] },
      textStyle: { color: c.muted, fontSize: 10 },
    },
    series: [{
      type: 'heatmap', data,
      label: { show: true, fontSize: 8.5, color: 'rgba(30,20,55,.75)', formatter: (p: { value: [number, number, number] }) => (p.value[2] > 0 ? nf0.format(p.value[2]) : '') },
      itemStyle: { borderRadius: 3, borderColor: '#ffffff', borderWidth: 1 },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(124,58,237,.4)' } },
    }],
  };
}

function top10Option(top: { name: string; m3: number; pay: number }[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: {
      ...b.tooltip, trigger: 'axis',
      formatter: (ps: P[]) => {
        const p = ps[0]; const m = top[p.dataIndex];
        return '<b>' + m.name + '</b><br/>' + nf1.format(m.m3) + ' m³ · pay %' + m.pay.toFixed(1);
      },
    },
    grid: { left: 6, right: 60, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    yAxis: {
      type: 'category', inverse: true, data: top.map((m) => m.name),
      axisLabel: { color: '#5b5470', fontSize: 10.5, width: 128, overflow: 'truncate' },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: top.map((m) => ({
        value: +m.m3.toFixed(1),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#7c3aed' }, { offset: 1, color: '#e879f9' }] }, borderRadius: [0, 6, 6, 0] },
      })),
      label: { show: true, position: 'right', color: c.muted, fontSize: 10, formatter: (p: P) => '%' + top[p.dataIndex].pay.toFixed(1) },
    }],
  };
}

function matrisOption(top: { name: string; kompleTIR: number; parsiyelTIR: number; konteyner: number }[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 } },
    grid: { left: 6, right: 20, top: 30, bottom: 4, containLabel: true },
    xAxis: { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    yAxis: {
      type: 'category', inverse: true, data: top.map((m) => m.name),
      axisLabel: { color: '#5b5470', fontSize: 10.5, width: 128, overflow: 'truncate' },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: (['kompleTIR', 'parsiyelTIR', 'konteyner'] as const).map((k, i) => ({
      name: ['Komple TIR', 'Parsiyel TIR', 'Konteyner'][i],
      type: 'bar', stack: 'toplam', barMaxWidth: 16,
      data: top.map((m) => +m[k].toFixed(1)),
      itemStyle: { color: [c.palette[0], c.palette[1], c.palette[3]][i] },
    })),
  };
}
