'use client';

/* Müşteri Analiz Merkezi — büyük müşteri detay penceresi (neredeyse tam ekran).
   İçindekiler: 8 KPI kartı, otomatik özet yorumları, 8 analiz grafiği
   (yıllık performans & değişim, ay×yıl ısı haritası, aylık trend, kümülatif hacim,
   bölüm dağılımı, ekipman tercihi, sezonluk düzen, haftanın günleri, yükleme ritmi),
   yıllara göre değişim tablosu ve son yüklemeler + PDF çıktısı.
   Rapor yüzeyi sabit açık "kağıt" tema kullanır; böylece PDF her zaman
   baskı dostu ve tutarlı olur. Veri/yükleme katmanına dokunmaz. */
import { useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileDown, Loader2, Boxes, Truck, Layers, CalendarDays, Gauge,
  Repeat, CalendarClock, CalendarCheck,
} from 'lucide-react';
import EChart, { baseChart } from './EChart';
import { DataTable, ClsBadge, StatusBadge } from './Shared';
import { monthlyAgg, custAgg, LIFE_LABEL } from '@/lib/sevkiyat/analytics';
import { tipDagilimi, gunYogunlugu, bolumPaylari, tipSinifi, TIP_SINIF_ETIKET, type TipSinif } from '@/lib/sevkiyat/reports';
import { nf0, nf1, fmtDate, uniq, norm, AYLAR, AYLAR_UZUN, ymLabel, maxDate } from '@/lib/sevkiyat/core';
import { elemanPdf, pdfDosyaAdi } from '@/lib/sevkiyat/pdfExport';
import { toast } from '@/hooks/use-toast';
import type { EChartsCoreOption } from 'echarts';
import type { Row } from '@/lib/sevkiyat/types';

type P = { dataIndex: number; value: number; name: string };

export default function CustomerDialog({ name, rows, onClose }: { name: string | null; rows: Row[]; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  const cRows = useMemo(() => (name ? rows.filter((r) => r.musteri === name) : []), [name, rows]);
  const cls = useMemo(() => custAgg(rows).find((c) => c.name === name)?.cls || 'C', [rows, name]);

  if (!name || !cRows.length) return null;

  /* ---- temel agregasyonlar ---- */
  const totalM3 = cRows.reduce((s, r) => s + r.m3, 0);
  const adet = cRows.reduce((s, r) => s + r.adet, 0);
  const sefer = cRows.length;
  const kapsam = rows.reduce((s, r) => s + r.m3, 0) || 1;
  const pay = (totalM3 / kapsam) * 100;

  const days = uniq(cRows.filter((r) => r.tarih).map((r) => r.tarihStr));
  const gunSayisi = days.length;
  const dts = days
    .map((s) => {
      const p = s.split('.').map(Number);
      return new Date(p[2], p[1] - 1, p[0]);
    })
    .sort((a, b) => a.getTime() - b.getTime());
  const firstD = dts[0] || null;
  const lastD = dts.length ? dts[dts.length - 1] : null;
  const avgInt = dts.length > 1 ? (dts[dts.length - 1].getTime() - dts[0].getTime()) / 864e5 / (dts.length - 1) : null;

  /* yükleme aralıkları (gün) */
  const diffs: number[] = [];
  for (let i = 1; i < dts.length; i++) diffs.push(Math.round((dts[i].getTime() - dts[i - 1].getTime()) / 864e5));
  const srt = [...diffs].sort((a, b) => a - b);
  const medyan = srt.length ? srt[Math.floor(srt.length / 2)] : null;
  const enUzun = srt.length ? srt[srt.length - 1] : null;

  const BUCKETS: [string, number, number][] = [
    ['1-3 gün', 1, 3], ['4-7 gün', 4, 7], ['8-14 gün', 8, 14], ['15-30 gün', 15, 30],
    ['31-60 gün', 31, 60], ['61-90 gün', 61, 90], ['90+ gün', 91, Infinity],
  ];
  const ritim = BUCKETS.map(([ad, lo, hi]) => ({ ad, n: diffs.filter((d) => d >= lo && d <= hi).length }));

  /* yıllar + YoY */
  type YilDeger = { yil: number; m3: number; adet: number; sefer: number };
  const yMap = new Map<number, YilDeger>();
  cRows.forEach((r) => {
    if (r.yil == null) return;
    const o = yMap.get(r.yil) || { yil: r.yil, m3: 0, adet: 0, sefer: 0 };
    o.m3 += r.m3; o.adet += r.adet; o.sefer += 1;
    yMap.set(r.yil, o);
  });
  const yillar = Array.from(yMap.values()).sort((a, b) => a.yil - b.yil);
  const yilTablo = yillar.map((y, i) => {
    const prev = i > 0 ? yillar[i - 1].m3 : 0;
    const delta = prev > 0 ? ((y.m3 - prev) / prev) * 100 : null;
    return { ...y, delta, seg: delta == null ? 'yeni' : delta >= 10 ? 'buyuyen' : delta <= -10 ? 'kuculen' : 'stabil' };
  }).reverse();

  /* aylar */
  const mon = monthlyAgg(cRows);
  const mon24 = mon.slice(-24);
  let acc = 0;
  const cum = mon.map((m) => { acc += m.m3; return { etiket: ymLabel(m.ym), cum: +acc.toFixed(1) }; });

  const sezonM3 = new Array(12).fill(0);
  const sezonAdet = new Array(12).fill(0);
  cRows.forEach((r) => {
    if (!r.tarih) return;
    sezonM3[r.tarih.getMonth()] += r.m3;
    sezonAdet[r.tarih.getMonth()] += r.adet;
  });
  const enYogunAyIdx = sezonM3.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);

  /* yıl × ay ısı haritası matrisi */
  const hmYillar = yillar.map((y) => y.yil);
  const hmIdx = new Map(hmYillar.map((y, i) => [y, i] as const));
  const hm: number[][] = hmYillar.map(() => new Array(12).fill(0));
  let hmMax = 0;
  cRows.forEach((r) => {
    if (!r.tarih || r.yil == null) return;
    const yi = hmIdx.get(r.yil);
    if (yi == null) return;
    hm[yi][r.tarih.getMonth()] += r.m3;
  });
  hm.forEach((row) => row.forEach((v) => { if (v > hmMax) hmMax = v; }));

  /* dağılımlar */
  const bolum = bolumPaylari(cRows);
  const tipler = tipDagilimi(cRows, 8);
  const gunler = gunYogunlugu(cRows);

  const ekip: Record<TipSinif, number> = { komple: 0, parsiyel: 0, konteyner: 0 };
  cRows.forEach((r) => { ekip[tipSinifi(r.tip)] += r.m3; });
  const tercih = (Object.entries(ekip) as [TipSinif, number][]).sort((a, b) => b[1] - a[1])[0];

  /* yaşam durumu */
  const ref = maxDate(rows);
  const gap = ref && lastD ? Math.max(0, Math.round((ref.getTime() - lastD.getTime()) / 864e5)) : null;
  const eff = avgInt != null ? Math.max(avgInt, 5) : null;
  const status: 'ok' | 'watch' | 'risk' | 'tek' =
    gunSayisi < 2 || eff == null || gap == null ? 'tek'
      : gap <= Math.round(eff * 1.3) ? 'ok'
        : gap <= Math.round(eff * 1.8) ? 'watch' : 'risk';
  const lifeTone = status === 'ok' ? 'ok' : status === 'watch' ? 'watch' : status === 'risk' ? 'risk' : 'neutral';
  const lifeLabel = LIFE_LABEL[status][0];

  const aySayisi = mon.length;
  const enAktif = yilTablo.length ? yilTablo.reduce((a, b) => (b.m3 > a.m3 ? b : a)) : null;
  const sonYil = yilTablo[0] || null;
  const initials = (name || '').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toLocaleUpperCase('tr-TR') || '').join('');

  const recent = cRows.slice().sort((a, b) => (b.tarih?.getTime() ?? 0) - (a.tarih?.getTime() ?? 0)).slice(0, 100);

  const pdfIndir = async () => {
    setBusy(true);
    try {
      const ok = await elemanPdf(document.getElementById('musteri-analiz-rapor'), pdfDosyaAdi('Musteri-' + norm(name)));
      toast({
        title: ok ? 'PDF indirildi' : 'PDF oluşturulamadı',
        description: ok ? name + ' analiz raporu kaydedildi' : 'Rapor bölümü bulunamadı',
        variant: ok ? undefined : 'destructive',
      });
    } catch {
      toast({ title: 'PDF oluşturulamadı', description: 'Sayfayı yenileyip tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[97vw] max-w-[1500px] sm:max-w-[1500px] h-[94vh] overflow-y-auto nice-scroll p-3 md:p-5 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{name} — Müşteri Analiz Merkezi</DialogTitle>
        </DialogHeader>

        <div id="musteri-analiz-rapor" className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-4 text-slate-800 shadow-sm">
          {/* ============ başlık ============ */}
          <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-[15px] font-extrabold flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
              {initials || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[17px] font-extrabold text-slate-900 leading-tight">{name}</span>
                <ClsBadge cls={cls} />
                <StatusBadge label={lifeLabel} tone={lifeTone} />
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {fmtDate(firstD) || '—'} – {fmtDate(lastD) || '—'} · {nf0.format(aySayisi)} ay aktif · {bolum.length} bölüm · {yillar.length} yıl
                {gap != null && <> · son yüklemenin üstünden {nf0.format(gap)} gün geçti</>}
              </div>
            </div>
            <Button size="sm" onClick={() => void pdfIndir()} disabled={busy}
              className="bg-violet-600 hover:bg-violet-700 text-white no-pdf">
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
              PDF indir
            </Button>
          </div>

          {/* ============ KPI kartları ============ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Kpi label="Toplam Hacim" deger={nf1.format(totalM3)} birim="m³" alt={'kapsam payı %' + nf1.format(pay)}
              ikon={<Boxes className="w-4 h-4" />} renk="violet" />
            <Kpi label="Araç / Ekipman" deger={nf0.format(adet)} birim="adet" alt="tüm ekipman tipleri"
              ikon={<Truck className="w-4 h-4" />} renk="amber" />
            <Kpi label="Sefer Kaydı" deger={nf0.format(sefer)} birim="sefer" alt="yükleme satırı"
              ikon={<Layers className="w-4 h-4" />} renk="pink" />
            <Kpi label="Yükleme Günü" deger={nf0.format(gunSayisi)} birim="gün" alt={aySayisi + ' ay içinde'}
              ikon={<CalendarDays className="w-4 h-4" />} renk="sky" />
            <Kpi label="Ort. Sefer Hacmi" deger={sefer ? nf1.format(totalM3 / sefer) : '0'} birim="m³/sefer" alt="hacim / sefer"
              ikon={<Gauge className="w-4 h-4" />} renk="emerald" />
            <Kpi label="Ort. Yükleme Aralığı" deger={avgInt != null ? nf1.format(avgInt) : '—'} birim={avgInt != null ? 'gün' : ''}
              alt={enUzun != null ? 'en uzun sessizlik ' + nf0.format(enUzun) + ' gün' : 'tek gün'}
              ikon={<Repeat className="w-4 h-4" />} renk="violet" />
            <Kpi label="İlk Yükleme" deger={fmtDate(firstD) || '—'} alt="abonelik başlangıcı"
              ikon={<CalendarClock className="w-4 h-4" />} renk="sky" />
            <Kpi label="Son Yükleme" deger={fmtDate(lastD) || '—'} alt={gap != null ? gap + ' gün önce' : ''}
              ikon={<CalendarCheck className="w-4 h-4" />} renk="amber" />
          </div>

          {/* ============ otomatik özet yorumları ============ */}
          <div className="flex flex-wrap gap-1.5">
            {enAktif && (
              <Chip renk="violet">🏆 En aktif yıl: {enAktif.yil} ({nf1.format(enAktif.m3)} m³)</Chip>
            )}
            {sonYil && sonYil.delta != null && (
              <Chip renk={sonYil.delta >= 0 ? 'emerald' : 'rose'}>
                {sonYil.delta >= 0 ? '📈' : '📉'} {sonYil.yil}: %{nf1.format(Math.abs(sonYil.delta))} {sonYil.delta >= 0 ? 'artış' : 'düşüş'}
              </Chip>
            )}
            {tercih && tercih[1] > 0 && (
              <Chip renk="amber">🚛 Tercih: {TIP_SINIF_ETIKET[tercih[0]]} (%{nf1.format((tercih[1] / (totalM3 || 1)) * 100)})</Chip>
            )}
            <Chip renk="sky">📅 En yoğun ay: {AYLAR_UZUN[enYogunAyIdx]}</Chip>
            <Chip renk="violet">⏱ Ort. aralık {avgInt != null ? nf1.format(avgInt) + ' gün' : '—'}{medyan != null ? ' · medyan ' + nf0.format(medyan) + ' gün' : ''}</Chip>
            <Chip renk="rose">🎯 ABC sınıfı: {cls} · pay %{nf1.format(pay)}</Chip>
          </div>

          {/* ============ grafikler ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Kart no={1} tam baslik="Yıllık Performans ve Değişim"
              desc="Yıllık toplam hacim (m³) + araç adedi · çubuk üstünde bir önceki yıla göre değişim %">
              <EChart option={yillikOption(yillar)} height={300} />
            </Kart>

            <Kart no={2} baslik="Aylık Trend (Son 24 Ay)" desc="Aylık araç adedi ve hacim (m³)">
              <EChart option={son24AyOption(mon24)} height={290} />
            </Kart>

            <Kart no={3} baslik="Bölüm Dağılımı" desc="EXPORT bölümlerinin hacim payı (m³)">
              <EChart option={donutOption(bolum.map((b) => ({ ad: b.ad, m3: b.m3 })), totalM3)} height={290} />
            </Kart>

            <Kart no={4} tam baslik="Ay × Yıl Yoğunluk Isı Haritası"
              desc="Yıllara göre aylık yükleme yoğunluğu — sezonsal düzen ve yıl bazlı değişim tek bakışta">
              <EChart option={yilAyIsiOption(hmYillar, hm, hmMax)} height={Math.min(Math.max(210, hmYillar.length * 36 + 110), 560)} />
            </Kart>

            <Kart no={5} baslik="Ekipman / Sevkiyat Tipi Tercihi" desc="Tip bazında toplam hacim (m³) ve pay">
              <EChart option={tipOption(tipler)} height={Math.min(Math.max(230, tipler.length * 36 + 60), 340)} />
            </Kart>

            <Kart no={6} baslik="Sezonluk Düzen (Ay Bazlı)" desc="Tüm yılların toplamı — hangi aylarda yükleme yoğunlaşıyor">
              <EChart option={sezonOption(sezonM3, sezonAdet)} height={290} />
            </Kart>

            <Kart no={7} baslik="Kümülatif Hacim Eğrisi" desc="Başlangıçtan bugüne birikimli toplam m³">
              <EChart option={kumulatifOption(cum)} height={290} />
            </Kart>

            <Kart no={8} baslik="Yükleme Ritmi — Aralık Dağılımı"
              desc="İki yükleme günü arasındaki gün sayısının dağılımı"
              saga={ritimOzet(medyan, enUzun, diffs.length)}>
              {diffs.length ? (
                <EChart option={ritimOption(ritim)} height={290} />
              ) : (
                <div className="h-[290px] flex items-center justify-center text-[12px] text-slate-400">
                  Ritim analizi için tek günlük yükleme yeterli değil — müşteri yalnızca 1 günde yüklendi.
                </div>
              )}
            </Kart>
          </div>

          {/* ============ yıllara göre değişim tablosu ============ */}
          <Kart tam baslik="Yıllara Göre Değişim Tablosu" desc="Yıl bazlı sefer, araç, hacim ve bir önceki aktif yıla göre değişim">
            <DataTable
              rows={yilTablo}
              maxHeight={320}
              compact
              cols={[
                { key: 'y', header: 'Yıl', cell: (r: (typeof yilTablo)[number]) => <b>{r.yil}</b> },
                { key: 's', header: 'Sefer', align: 'right', cell: (r: (typeof yilTablo)[number]) => nf0.format(r.sefer) },
                { key: 'a', header: 'Araç', align: 'right', cell: (r: (typeof yilTablo)[number]) => nf0.format(r.adet) },
                { key: 'm', header: 'Hacim (m³)', align: 'right', cell: (r: (typeof yilTablo)[number]) => nf1.format(r.m3) },
                {
                  key: 'd', header: 'Yıllık Değişim', align: 'right',
                  cell: (r: (typeof yilTablo)[number]) =>
                    r.delta == null ? <span className="text-slate-400">—</span> : (
                      <span className={'font-semibold tabular-nums ' + (r.delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {r.delta >= 0 ? '+' : ''}{nf1.format(r.delta)}%
                      </span>
                    ),
                },
                {
                  key: 'g', header: 'Segment', align: 'center',
                  cell: (r: (typeof yilTablo)[number]) => (
                    <StatusBadge
                      label={r.seg === 'buyuyen' ? 'Büyüyen' : r.seg === 'kuculen' ? 'Küçülen' : r.seg === 'yeni' ? 'Yeni' : 'Stabil'}
                      tone={r.seg === 'buyuyen' ? 'up' : r.seg === 'kuculen' ? 'dn' : r.seg === 'yeni' ? 'neutral' : 'mid'}
                    />
                  ),
                },
              ]}
            />
          </Kart>

          {/* ============ son yüklemeler ============ */}
          <Kart tam baslik="Son Yüklemeler" desc={'En yeni 100 kayıt · toplam ' + nf0.format(sefer) + ' sefer'}>
            <DataTable
              rows={recent}
              maxHeight={330}
              compact
              cols={[
                { key: 't', header: 'Tarih', cell: (r: Row) => r.tarihStr || '—' },
                { key: 'g', header: 'Gün', cell: (r: Row) => r.gun || '—' },
                { key: 'b', header: 'Bölüm', cell: (r: Row) => r.bolum },
                { key: 'tip', header: 'Tip', cell: (r: Row) => r.tip },
                { key: 'a', header: 'Adet', align: 'right', cell: (r: Row) => nf0.format(r.adet) },
                { key: 'm', header: 'm³', align: 'right', cell: (r: Row) => nf1.format(r.m3) },
              ]}
            />
          </Kart>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
            <span>YATSAN İhracat Yükleme Paneli · Müşteri Analiz Raporu · {name}</span>
            <span>Oluşturulma: {new Date().toLocaleDateString('tr-TR')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= yardımcı bileşenler ================= */

function ritimOzet(medyan: number | null, enUzun: number | null, n: number): ReactNode {
  if (!n) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">{n} aralık</span>
      {medyan != null && <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-violet-700">medyan {medyan} gün</span>}
      {enUzun != null && <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">en uzun {enUzun} gün</span>}
    </div>
  );
}

function Kpi({ label, deger, birim, alt, ikon, renk }: {
  label: string; deger: string; birim?: string; alt?: string; ikon: ReactNode; renk: 'violet' | 'amber' | 'pink' | 'sky' | 'emerald';
}) {
  const r: Record<string, string> = {
    violet: 'from-violet-500 to-fuchsia-500 shadow-violet-500/25',
    amber: 'from-amber-400 to-orange-500 shadow-amber-500/25',
    pink: 'from-pink-500 to-rose-500 shadow-pink-500/25',
    sky: 'from-sky-500 to-cyan-500 shadow-sky-500/25',
    emerald: 'from-emerald-500 to-teal-500 shadow-emerald-500/25',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex items-center gap-2.5">
      <div className={'w-9 h-9 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-md shrink-0 ' + r[renk]}>
        {ikon}
      </div>
      <div className="min-w-0">
        <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</div>
        <div className="text-[16.5px] font-extrabold text-slate-900 leading-tight truncate">
          {deger}{birim && <span className="text-[10.5px] font-semibold text-slate-500 ml-0.5">{birim}</span>}
        </div>
        {alt && <div className="text-[9.5px] text-slate-500 truncate">{alt}</div>}
      </div>
    </div>
  );
}

function Chip({ renk, children }: { renk: 'violet' | 'amber' | 'emerald' | 'sky' | 'rose'; children: ReactNode }) {
  const r: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
    sky: 'bg-sky-500/10 text-sky-700 ring-sky-500/20',
    rose: 'bg-rose-500/10 text-rose-700 ring-rose-500/20',
  };
  return <span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ' + r[renk]}>{children}</span>;
}

function Kart({ no, baslik, desc, saga, children, tam }: {
  no?: number; baslik: string; desc?: string; saga?: ReactNode; children: ReactNode; tam?: boolean;
}) {
  return (
    <div className={'rounded-xl border border-slate-200 bg-white p-4 shadow-sm ' + (tam ? 'lg:col-span-2' : '')}>
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

function yillikOption(y: { yil: number; m3: number; adet: number }[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis' },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 } },
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: y.map((v) => String(v.yil)),
      axisLabel: { color: c.muted, fontSize: 11.5, fontWeight: 'bold' },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
      { type: 'value', name: 'Araç', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Hacim (m³)', type: 'bar', barMaxWidth: 52,
        data: y.map((v, i) => {
          const prev = i > 0 ? y[i - 1].m3 : 0;
          const d = prev > 0 ? ((v.m3 - prev) / prev) * 100 : null;
          return {
            value: +v.m3.toFixed(1),
            itemStyle: {
              color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#a78bfa' }, { offset: 1, color: '#7c3aed' }] },
              borderRadius: [6, 6, 0, 0],
            },
            label: d != null
              ? {
                  show: true, position: 'top', fontSize: 10.5, fontWeight: 'bold',
                  color: d >= 0 ? '#059669' : '#dc2626',
                  formatter: (d >= 0 ? '+' : '') + nf1.format(d) + '%',
                }
              : { show: true, position: 'top', fontSize: 10, color: c.muted, formatter: (p: P) => nf0.format(p.value) },
          };
        }),
      },
      {
        name: 'Araç Adedi', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 6,
        data: y.map((v) => v.adet),
        lineStyle: { width: 2.5, color: c.palette[1] }, itemStyle: { color: c.palette[1] },
      },
    ],
  };
}

function son24AyOption(m: { ym: string; adet: number; m3: number }[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis' },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 } },
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: m.map((x) => ymLabel(x.ym)),
      axisLabel: { color: c.muted, fontSize: 10, rotate: 38 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', name: 'Araç', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitLine: { lineStyle: { color: c.split } } },
      { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: 'Araç', type: 'bar', barMaxWidth: 16, data: m.map((x) => x.adet), itemStyle: { color: c.palette[0], borderRadius: [3, 3, 0, 0] } },
      { name: 'm³', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none', data: m.map((x) => +x.m3.toFixed(1)), lineStyle: { width: 2.5, color: c.palette[1] }, itemStyle: { color: c.palette[1] } },
    ],
  };
}

function donutOption(bolum: { ad: string; m3: number }[], toplamM3: number): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  type DP = { name: string; value: number; percent: number };
  return {
    textStyle: b.textStyle,
    tooltip: {
      ...b.tooltip, trigger: 'item',
      formatter: (p: DP) => p.name + '<br/>' + nf1.format(p.value) + ' m³ · %' + p.percent.toFixed(1),
    },
    legend: { bottom: 0, icon: 'circle', textStyle: { color: c.muted, fontSize: 11 } },
    title: {
      text: nf1.format(toplamM3), subtext: 'toplam m³', left: 'center', top: '34%',
      textStyle: { fontSize: 20, fontWeight: 'bold', color: '#1e1b2e' },
      subtextStyle: { fontSize: 11, color: c.muted },
    },
    series: [{
      type: 'pie', radius: ['50%', '72%'], center: ['50%', '44%'], avoidLabelOverlap: true,
      itemStyle: { borderRadius: 8, borderColor: '#ffffff', borderWidth: 2 },
      label: { color: c.muted, fontSize: 11, formatter: (p: DP) => p.name + '\n%' + p.percent.toFixed(1) },
      labelLine: { lineStyle: { color: c.axis } },
      data: bolum.map((d, i) => ({ name: d.ad, value: +d.m3.toFixed(1), itemStyle: { color: c.palette[i % c.palette.length] } })),
    }],
  };
}

function yilAyIsiOption(yillar: number[], hm: number[][], max: number): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  const data: [number, number, number][] = [];
  hm.forEach((row, yi) => row.forEach((v, mi) => { if (v > 0) data.push([mi, yi, +v.toFixed(1)]); }));
  type HP = { value: [number, number, number] };
  return {
    textStyle: b.textStyle,
    tooltip: {
      ...b.tooltip,
      formatter: (p: HP) => AYLAR[p.value[0]] + ' ' + yillar[p.value[1]] + '<br/><b>' + nf1.format(p.value[2]) + ' m³</b>',
    },
    grid: { left: 6, right: 10, top: 8, bottom: 44, containLabel: true },
    xAxis: { type: 'category', data: AYLAR, splitArea: { show: true }, axisLabel: { color: c.muted, fontSize: 10.5 }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'category', data: yillar.map(String), axisLabel: { color: c.muted, fontSize: 10.5, fontWeight: 'bold' }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: {
      min: 0, max: max || 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#3b0764'] },
      textStyle: { color: c.muted, fontSize: 10 },
    },
    series: [{
      type: 'heatmap', data,
      label: { show: true, fontSize: 9, color: 'rgba(30,20,55,.78)', formatter: (p: HP) => (p.value[2] > 0 ? nf0.format(p.value[2]) : '') },
      itemStyle: { borderRadius: 3, borderColor: '#ffffff', borderWidth: 1 },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(124,58,237,.4)' } },
    }],
  };
}

function tipOption(tipler: { ad: string; m3: number; adet: number; pay: number }[]): EChartsCoreOption {
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
    grid: { left: 6, right: 56, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
    yAxis: {
      type: 'category', inverse: true, data: tipler.map((t) => t.ad),
      axisLabel: { color: '#5b5470', fontSize: 10.5, width: 120, overflow: 'truncate' },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: tipler.map((t) => ({
        value: +t.m3.toFixed(1),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#7c3aed' }, { offset: 1, color: '#e879f9' }] }, borderRadius: [0, 6, 6, 0] },
      })),
      label: { show: true, position: 'right', color: c.muted, fontSize: 10, formatter: (p: P) => '%' + tipler[p.dataIndex].pay.toFixed(1) },
    }],
  };
}

function sezonOption(m3: number[], adet: number[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis' },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 } },
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: AYLAR,
      axisLabel: { color: c.muted, fontSize: 10.5 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', name: 'm³', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) }, splitLine: { lineStyle: { color: c.split } } },
      { type: 'value', name: 'Araç', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Toplam m³', type: 'bar', barMaxWidth: 22,
        data: m3.map((v) => ({
          value: +v.toFixed(1),
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#a78bfa' }, { offset: 1, color: '#7c3aed' }] }, borderRadius: [5, 5, 0, 0] },
        })),
      },
      { name: 'Araç', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 5, data: adet, lineStyle: { width: 2, color: c.palette[1] }, itemStyle: { color: c.palette[1] } },
    ],
  };
}

function kumulatifOption(cum: { etiket: string; cum: number }[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis' },
    grid: { left: 6, right: 10, top: 26, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', boundaryGap: false, data: cum.map((x) => x.etiket),
      axisLabel: { color: c.muted, fontSize: 10, rotate: 38 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value', name: 'kümülatif m³', nameTextStyle: { color: c.muted, fontSize: 11 },
      axisLabel: { color: c.muted, fontSize: 10.5, formatter: (v: number) => nf0.format(v) },
      splitLine: { lineStyle: { color: c.split } },
    },
    series: [{
      name: 'Kümülatif m³', type: 'line', smooth: true, symbol: 'none',
      data: cum.map((x) => x.cum),
      lineStyle: { width: 3, color: c.palette[0] },
      itemStyle: { color: c.palette[0] },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(124,58,237,.30)' }, { offset: 1, color: 'rgba(124,58,237,.02)' }] } },
    }],
  };
}

function ritimOption(ritim: { ad: string; n: number }[]): EChartsCoreOption {
  const b = baseChart(false);
  const c = b.c;
  const renkler = ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#dc2626', '#7f1d1d'];
  return {
    textStyle: b.textStyle,
    tooltip: { ...b.tooltip, trigger: 'axis', formatter: (ps: P[]) => ps[0].name + '<br/><b>' + ps[0].value + ' aralık</b>' },
    grid: { left: 6, right: 6, top: 26, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: ritim.map((r) => r.ad),
      axisLabel: { color: c.muted, fontSize: 10 },
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', name: 'aralık sayısı', nameTextStyle: { color: c.muted, fontSize: 10.5 }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitLine: { lineStyle: { color: c.split } } },
    series: [{
      type: 'bar', barMaxWidth: 34,
      data: ritim.map((r, i) => ({
        value: r.n,
        itemStyle: { color: renkler[i % renkler.length], borderRadius: [5, 5, 0, 0] },
      })),
      label: { show: true, position: 'top', color: c.muted, fontSize: 10, formatter: (p: P) => (p.value > 0 ? String(p.value) : '') },
    }],
  };
}
