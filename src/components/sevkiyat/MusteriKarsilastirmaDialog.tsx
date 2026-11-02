'use client';

/* Müşteri Karşılaştırma Merkezi — 2-4 müşteriyi yan yana kıyaslar:
   KPI matrisi, yıllık hacim karşılaştırması, yıllık değişim (YoY %),
   aylık trend (son 24 ay), sezonluk düzen (12 ay) ve ekipman tercihi.
   Kağıt (açık) tema + PDF çıktısı. Veri katmanına dokunmaz. */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import EChart, { baseChart } from './EChart';
import { custAgg } from '@/lib/sevkiyat/analytics';
import { tipSinifi, TIP_SINIF_ETIKET, type TipSinif } from '@/lib/sevkiyat/reports';
import { nf0, nf1, fmtDate, AYLAR, ymLabel, maxDate } from '@/lib/sevkiyat/core';
import { elemanPdf, pdfDosyaAdi } from '@/lib/sevkiyat/pdfExport';
import { toast } from '@/hooks/use-toast';
import { LIFE_LABEL } from '@/lib/sevkiyat/analytics';
import type { EChartsCoreOption } from 'echarts';
import type { Row } from '@/lib/sevkiyat/types';

type P = { dataIndex: number; value: number; name: string };
type SeriesP = { seriesName: string; dataIndex: number; value: number };

interface Metrikler {
  name: string;
  m3: number;
  adet: number;
  sefer: number;
  gun: number;
  ortSefer: number;
  ortAralik: number | null;
  ilk: Date | null;
  son: Date | null;
  pay: number;
  cls: 'A' | 'B' | 'C';
  ritim: 'ok' | 'watch' | 'risk' | 'tek';
  ekip: Record<TipSinif, number>;
  yillik: Map<number, number>;
  ym: Map<string, number>;
  sezon: number[];
}

const RENKLER = ['#7c3aed', '#f59e0b', '#10b981', '#ec4899'];

export default function MusteriKarsilastirmaDialog({ names, rows, onClose }: { names: string[]; rows: Row[]; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const secili = names.slice(0, 4);

  const M = useMemo<Metrikler[]>(() => {
    const kapsam = rows.reduce((s, r) => s + r.m3, 0) || 1;
    const refD = maxDate(rows);
    const refT = refD ? refD.getTime() : null;
    const clsMap = new Map(custAgg(rows).map((c) => [c.name, c.cls] as const));
    return secili.map((name) => {
      const cr = rows.filter((r) => r.musteri === name);
      const m3 = cr.reduce((s, r) => s + r.m3, 0);
      const adet = cr.reduce((s, r) => s + r.adet, 0);
      const days = Array.from(new Set(cr.filter((r) => r.tarih).map((r) => r.tarihStr)))
        .map((s) => {
          const p = s.split('.').map(Number);
          return new Date(p[2], p[1] - 1, p[0]).getTime();
        })
        .sort((a, b) => a - b);
      const ilk = days.length ? new Date(days[0]) : null;
      const son = days.length ? new Date(days[days.length - 1]) : null;
      const ortAralik = days.length > 1 ? (days[days.length - 1] - days[0]) / 864e5 / (days.length - 1) : null;

      /* ritim */
      const gap = refT != null && son ? Math.max(0, Math.round((refT - son.getTime()) / 864e5)) : null;
      const eff = ortAralik != null ? Math.max(ortAralik, 5) : null;
      const ritim: Metrikler['ritim'] =
        days.length < 2 || eff == null || gap == null ? 'tek'
          : gap <= Math.round(eff * 1.3) ? 'ok'
            : gap <= Math.round(eff * 1.8) ? 'watch' : 'risk';

      const ekip: Record<TipSinif, number> = { komple: 0, parsiyel: 0, konteyner: 0 };
      const yillik = new Map<number, number>();
      const ym = new Map<string, number>();
      const sezon = new Array(12).fill(0);
      cr.forEach((r) => {
        ekip[tipSinifi(r.tip)] += r.m3;
        if (r.yil != null) yillik.set(r.yil, (yillik.get(r.yil) || 0) + r.m3);
        if (r.tarih) {
          const k = r.tarih.getFullYear() + '-' + String(r.tarih.getMonth() + 1).padStart(2, '0');
          ym.set(k, (ym.get(k) || 0) + r.m3);
          sezon[r.tarih.getMonth()] += r.m3;
        }
      });
      return {
        name, m3, adet, sefer: cr.length, gun: days.length,
        ortSefer: cr.length ? m3 / cr.length : 0, ortAralik, ilk, son,
        pay: (m3 / kapsam) * 100, cls: clsMap.get(name) || 'C', ritim, ekip, yillik, ym, sezon,
      };
    });
  }, [rows, secili.join('¦')]);

  const yillar = useMemo(() => {
    const s = new Set<number>();
    M.forEach((m) => m.yillik.forEach((_, y) => s.add(y)));
    return Array.from(s).sort((a, b) => a - b);
  }, [M]);

  const ym24 = useMemo(() => {
    const s = new Set<string>();
    M.forEach((m) => m.ym.forEach((_, k) => s.add(k)));
    return Array.from(s).sort().slice(-24);
  }, [M]);

  if (!M.length) return null;

  const pdfIndir = async () => {
    setBusy(true);
    try {
      const ok = await elemanPdf(document.getElementById('musteri-karsilastirma'), pdfDosyaAdi('Musteri-Karsilastirma'));
      toast({
        title: ok ? 'PDF indirildi' : 'PDF oluşturulamadı',
        description: ok ? 'Karşılaştırma raporu kaydedildi' : 'Rapor bölümü bulunamadı',
        variant: ok ? undefined : 'destructive',
      });
    } catch {
      toast({ title: 'PDF oluşturulamadı', description: 'Sayfayı yenileyip tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const renk = (i: number) => RENKLER[i % RENKLER.length];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[97vw] max-w-[1500px] sm:max-w-[1500px] h-[94vh] overflow-y-auto nice-scroll p-3 md:p-5 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Müşteri Karşılaştırma Merkezi</DialogTitle>
        </DialogHeader>

        <div id="musteri-karsilastirma" className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-4 text-slate-800 shadow-sm">
          {/* başlık */}
          <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-3">
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-extrabold text-slate-900 leading-tight">⚔️ Müşteri Karşılaştırma Merkezi</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {secili.length} müşteri · yıl ve ay bazlı kıyas · {yillar.length} yıl · son 24 ay
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {M.map((m, i) => (
                  <span key={m.name} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1"
                    style={{ background: renk(i) + '14', color: renk(i), borderColor: renk(i) + '40', boxShadow: 'none' }}>
                    <i className="w-2 h-2 rounded-full inline-block" style={{ background: renk(i) }} />
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={() => void pdfIndir()} disabled={busy}
              className="bg-violet-600 hover:bg-violet-700 text-white no-pdf">
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
              PDF indir
            </Button>
          </div>

          {/* KPI matrisi */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-auto nice-scroll">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left font-semibold text-[10.5px] uppercase tracking-wide text-slate-500 px-3 py-2 border-b w-[170px]">Metrik</th>
                    {M.map((m, i) => (
                      <th key={m.name} className="text-right font-bold text-[12px] px-3 py-2 border-b" style={{ color: renk(i) }}>
                        {m.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Toplam Hacim (m³)', (m: Metrikler) => nf1.format(m.m3), true],
                    ['Araç / Ekipman', (m: Metrikler) => nf0.format(m.adet), true],
                    ['Sefer Kaydı', (m: Metrikler) => nf0.format(m.sefer), true],
                    ['Yükleme Günü', (m: Metrikler) => nf0.format(m.gun), true],
                    ['Ort. Sefer Hacmi (m³)', (m: Metrikler) => nf1.format(m.ortSefer), true],
                    ['Ort. Yükleme Aralığı', (m: Metrikler) => (m.ortAralik != null ? nf1.format(m.ortAralik) + ' gün' : '—'), false],
                    ['İlk Yükleme', (m: Metrikler) => fmtDate(m.ilk) || '—', false],
                    ['Son Yükleme', (m: Metrikler) => fmtDate(m.son) || '—', false],
                    ['Kapsam Payı', (m: Metrikler) => '%' + nf1.format(m.pay), false],
                    ['ABC Sınıfı', (m: Metrikler) => m.cls, false],
                    ['Ritim Durumu', (m: Metrikler) => LIFE_LABEL[m.ritim][0], false],
                    ['En Yoğun Ay', (m: Metrikler) => AyAdi(m.sezon), false],
                  ].map(([label, fn, bold]) => (
                    <tr key={label as string} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 text-slate-500 text-[11.5px]">{label as string}</td>
                      {M.map((m) => (
                        <td key={m.name} className={'px-3 py-1.5 text-right tabular-nums ' + (bold ? 'font-bold text-slate-900' : 'text-slate-700')}>
                          {(fn as (m: Metrikler) => string)(m)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* grafikler */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Kart no={1} tam baslik="Yıllık Hacim Karşılaştırması (m³)" desc="Seçili müşterilerin yıllık toplam hacmi — yıl ve ay karşılaştırması">
              <EChart option={yillikBarOption(M, yillar)} height={300} />
            </Kart>

            <Kart no={2} baslik="Aylık Trend Karşılaştırması" desc="Son 24 ayın aylık hacim eğrileri (m³)">
              <EChart option={aylikCizgiOption(M, ym24)} height={300} />
            </Kart>

            <Kart no={3} baslik="Sezonluk Düzen Karşılaştırması" desc="12 ayın toplam hacmi — hangi müşteri hangi aylarda yoğun">
              <EChart option={sezonCizgiOption(M)} height={300} />
            </Kart>

            <Kart no={4} tam baslik="Ekipman / Sevkiyat Tipi Tercihi" desc="Komple TIR · Parsiyel TIR · Konteyner kırılımı (m³, yığınlı)">
              <EChart option={ekipmanOption(M)} height={Math.min(Math.max(200, M.length * 52 + 60), 320)} />
            </Kart>
          </div>

          {/* yıl tablosu */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[13px] font-bold text-slate-800 mb-2">📅 Yıllık Karşılaştırma Tablosu</div>
            <div className="overflow-auto nice-scroll rounded-lg border">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left font-semibold text-[10.5px] uppercase tracking-wide text-slate-500 px-2.5 py-2 border-b">Yıl</th>
                    {M.map((m, i) => (
                      <th key={m.name} className="text-right font-bold text-[11.5px] px-2.5 py-2 border-b" style={{ color: renk(i) }}>{m.name} (m³)</th>
                    ))}
                    <th className="text-right font-semibold text-[10.5px] uppercase tracking-wide text-slate-500 px-2.5 py-2 border-b">Yıl Lideri</th>
                  </tr>
                </thead>
                <tbody>
                  {[...yillar].reverse().map((y) => {
                    const degerler = M.map((m) => m.yillik.get(y) || 0);
                    const max = Math.max(...degerler);
                    const lider = max > 0 ? M[degerler.indexOf(max)].name : '—';
                    return (
                      <tr key={y} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-2.5 py-1.5 font-bold text-slate-900">{y}</td>
                        {degerler.map((v, i) => (
                          <td key={i} className={'px-2.5 py-1.5 text-right tabular-nums ' + (v > 0 && v === max && degerler.filter((x) => x > 0).length > 1 ? 'font-bold' : '')}
                            style={v > 0 && v === max && degerler.filter((x) => x > 0).length > 1 ? { color: renk(i) } : undefined}>
                            {v > 0 ? nf1.format(v) : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                        <td className="px-2.5 py-1.5 text-right text-slate-600">{lider}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
            <span>YATSAN İhracat Yükleme Paneli · Müşteri Karşılaştırma Raporu</span>
            <span>Oluşturulma: {new Date().toLocaleDateString('tr-TR')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AyAdi(sezon: number[]): string {
  const AYLAR_UZ = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  let mi = 0;
  sezon.forEach((v, i) => { if (v > sezon[mi]) mi = i; });
  return sezon[mi] > 0 ? AYLAR_UZ[mi] : '—';
}

function Kart({ no, baslik, desc, children, tam }: { no: number; baslik: string; desc?: string; children: React.ReactNode; tam?: boolean }) {
  return (
    <div className={'rounded-xl border border-slate-200 bg-white p-4 shadow-sm ' + (tam ? 'lg:col-span-2' : '')}>
      <div className="mb-2">
        <div className="text-[13px] font-bold text-slate-800">
          <span className="text-violet-600">Grafik {no} · </span>{baslik}
        </div>
        {desc && <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

/* ================= grafik seçenekleri (sabit açık tema) ================= */

function yillikBarOption(M: Metrikler[], yillar: number[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 }, type: 'scroll' },
    grid: { left: 6, right: 6, top: 36, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: yillar.map(String),
      axisLabel: { color: c.muted, fontSize: 11.5, fontWeight: 'bold' },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    series: M.map((m, i) => ({
      name: m.name, type: 'bar', barMaxWidth: 26,
      data: yillar.map((y) => +(m.yillik.get(y) || 0).toFixed(1)),
      itemStyle: { color: RENKLER[i % RENKLER.length], borderRadius: [4, 4, 0, 0] },
    })),
  };
}

function aylikCizgiOption(M: Metrikler[], ym24: string[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis' },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 }, type: 'scroll' },
    grid: { left: 6, right: 10, top: 36, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', boundaryGap: false, data: ym24.map(ymLabel),
      axisLabel: { color: c.muted, fontSize: 10, rotate: 38 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    series: M.map((m, i) => ({
      name: m.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      data: ym24.map((k) => +(m.ym.get(k) || 0).toFixed(1)),
      lineStyle: { width: 2.5, color: RENKLER[i % RENKLER.length] },
      itemStyle: { color: RENKLER[i % RENKLER.length] },
    })),
  };
}

function sezonCizgiOption(M: Metrikler[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: {
      ...b.tooltip, trigger: 'axis',
      formatter: (ps: SeriesP[]) => AYLAR[ps[0].dataIndex] + '<br/>' + ps.map((p) => {
        const m = M.find((x) => x.name === p.seriesName);
        return '<b>' + p.seriesName + '</b>: ' + (m ? nf1.format(m.sezon[p.dataIndex]) : '0') + ' m³';
      }).join('<br/>'),
    },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 }, type: 'scroll' },
    grid: { left: 6, right: 10, top: 36, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', boundaryGap: false, data: AYLAR,
      axisLabel: { color: c.muted, fontSize: 10.5 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    series: M.map((m, i) => ({
      name: m.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
      data: m.sezon.map((v) => +v.toFixed(1)),
      lineStyle: { width: 2.5, color: RENKLER[i % RENKLER.length] },
      itemStyle: { color: RENKLER[i % RENKLER.length] },
      areaStyle: { color: RENKLER[i % RENKLER.length] + '0d' },
    })),
  };
}

function ekipmanOption(M: Metrikler[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  const renkler = [c.palette[0], c.palette[1], c.palette[3]];
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 } },
    grid: { left: 6, right: 20, top: 30, bottom: 4, containLabel: true },
    xAxis: { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    yAxis: {
      type: 'category', inverse: true, data: M.map((m) => m.name),
      axisLabel: { color: '#5b5470', fontSize: 10.5, width: 150, overflow: 'truncate' },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: (['komple', 'parsiyel', 'konteyner'] as const).map((k, i) => ({
      name: TIP_SINIF_ETIKET[k], type: 'bar', stack: 'toplam', barMaxWidth: 20,
      data: M.map((m) => +m.ekip[k].toFixed(1)),
      itemStyle: { color: renkler[i] },
    })),
  };
}
