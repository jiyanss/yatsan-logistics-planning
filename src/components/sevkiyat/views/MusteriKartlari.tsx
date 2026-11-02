'use client';

/* Müşteri Kartları — müşteri bazlı özet kartlar.
   Arama + yıl filtresi + sıralama; yıllara göre değişim (YoY) rozetleri,
   yıl mini bar grafiği ve ekipman tercih çubuğu içerir. Kart tıklandığında
   müşteri detay penceresi açılır. */
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClsBadge, EmptyState, StatusBadge } from '../Shared';
import CustomerDialog from '../CustomerDialog';
import MusteriKarsilastirmaDialog from '../MusteriKarsilastirmaDialog';
import { LIFE_LABEL } from '@/lib/sevkiyat/analytics';
import { useSevkiyat } from '@/lib/sevkiyat/store';
import { musteriKartlari, yilListesi } from '@/lib/sevkiyat/reports';
import { asciiLower, nf0, nf1, fmtDate } from '@/lib/sevkiyat/core';
import { Search, ArrowUpRight, ArrowDownRight, Contact, Swords, X } from 'lucide-react';
import type { Row } from '@/lib/sevkiyat/types';

type Sira = 'm3' | 'adet' | 'degisim' | 'isim';

const GIDEREKEN = 120;

export default function MusteriKartlari() {
  const { data } = useSevkiyat();
  const [q, setQ] = useState('');
  const [yil, setYil] = useState<string>('all');
  const [sira, setSira] = useState<Sira>('m3');
  const [secili, setSecili] = useState<string | null>(null);
  const [kars, setKars] = useState(false);
  const [ksecim, setKsecim] = useState<string[]>([]);
  const [karsAcik, setKarsAcik] = useState(false);

  const toggleSec = (name: string) => {
    setKsecim((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : cur.length >= 4 ? cur : [...cur, name]));
  };

  const yillar = useMemo(() => yilListesi(data), [data]);
  const kartlar = useMemo(
    () => musteriKartlari(data, yil === 'all' ? null : +yil),
    [data, yil]
  );

  const list = useMemo(() => {
    const qq = asciiLower(q.trim());
    let l = qq ? kartlar.filter((k) => asciiLower(k.name).indexOf(qq) >= 0) : kartlar;
    l = [...l].sort((a, b) => {
      if (sira === 'isim') return a.name.localeCompare(b.name, 'tr');
      if (sira === 'adet') return b.adet - a.adet;
      if (sira === 'degisim') return (b.degisim ?? -1e12) - (a.degisim ?? -1e12);
      return b.m3 - a.m3;
    });
    return l;
  }, [kartlar, q, sira]);

  const kapsamM3 = useMemo(() => list.reduce((s, k) => s + k.m3, 0), [list]);

  if (!data.length) {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <EmptyState
          icon={<Contact className="w-6 h-6" />}
          title="Henüz veri yok"
          desc="Müşteri kartları için önce Excel dosyanızı yükleyin."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="relative flex-1 min-w-[210px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri ara…"
            className="pl-8 h-9 bg-card" aria-label="Müşteri ara" />
        </div>
        <Select value={yil} onValueChange={setYil}>
          <SelectTrigger className="w-[132px] h-9" aria-label="Yıl filtresi"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm yıllar</SelectItem>
            {yillar.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sira} onValueChange={(v) => setSira(v as Sira)}>
          <SelectTrigger className="w-[158px] h-9" aria-label="Sıralama"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="m3">Hacime göre</SelectItem>
            <SelectItem value="adet">Araç adedine göre</SelectItem>
            <SelectItem value="degisim">Yıllık değişime göre</SelectItem>
            <SelectItem value="isim">İsme göre (A-Z)</SelectItem>
          </SelectContent>
        </Select>
        {/* karşılaştırma modu */}
        {kars ? (
          <>
            <Button size="sm" className="h-9 bg-violet-600 hover:bg-violet-700 text-white" disabled={ksecim.length < 2}
              onClick={() => setKarsAcik(true)}>
              <Swords className="w-4 h-4 mr-1.5" /> Karşılaştır ({ksecim.length})
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setKars(false); setKsecim([]); }}>
              <X className="w-4 h-4 mr-1" /> Kapat
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className="h-9" onClick={() => { setKars(true); setKsecim([]); }}>
            <Swords className="w-4 h-4 mr-1.5" /> Karşılaştırma modu
          </Button>
        )}
      </div>

      <div className="text-[11.5px] text-muted-foreground">
        <b className="text-foreground">{nf0.format(list.length)}</b> müşteri
        {yil !== 'all' ? <> · <b className="text-foreground">{yil}</b> yılı toplamı: <b className="text-foreground">{nf1.format(kapsamM3)} m³</b></> : <> · tüm zamanlar: <b className="text-foreground">{nf1.format(kapsamM3)} m³</b></>}
        {list.length > GIDEREKEN && ' · ilk ' + GIDEREKEN + ' kart gösteriliyor (arama ile daraltın)'}
        {kars && ksecim.length < 2 && ' · ⚔️ karşılaştırmak için 2-4 müşteri kartına tıklayın'}
      </div>

      {/* Kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {list.slice(0, GIDEREKEN).map((k) => (
          <MusteriKart key={k.name} k={k} karsMode={kars} secili={ksecim.includes(k.name)}
            onOpen={() => setSecili(k.name)} onToggle={() => toggleSec(k.name)} />
        ))}
      </div>

      {secili && <CustomerDialog name={secili} rows={data as Row[]} onClose={() => setSecili(null)} />}
      {karsAcik && ksecim.length >= 2 && (
        <MusteriKarsilastirmaDialog names={ksecim} rows={data as Row[]} onClose={() => setKarsAcik(false)} />
      )}
    </div>
  );
}

/* ================= kart ================= */

const RING: Record<'A' | 'B' | 'C', string> = {
  A: 'ring-2 ring-violet-500/50',
  B: 'ring-2 ring-amber-500/45',
  C: 'ring-1 ring-border',
};

const AVATAR: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-gradient-to-br from-violet-500 to-fuchsia-500',
  B: 'bg-gradient-to-br from-amber-400 to-orange-500',
  C: 'bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700',
};

function MusteriKart({ k, onOpen, karsMode, secili, onToggle }: {
  k: ReturnType<typeof musteriKartlari>[number];
  onOpen: () => void;
  karsMode: boolean;
  secili: boolean;
  onToggle: () => void;
}) {
  const initials = k.name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toLocaleUpperCase('tr-TR') || '').join('');
  const ekipTop = k.kompleTIR + k.parsiyelTIR + k.konteyner || 1;
  const yl = k.yillar.slice(-6);
  const yMax = Math.max(...yl.map((y) => y.m3), 1);

  return (
    <button
      onClick={karsMode ? onToggle : onOpen}
      className={'group relative text-left rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ' +
        (karsMode && secili ? 'ring-2 ring-violet-600 border-violet-400' : RING[k.cls])}
      aria-label={k.name + (karsMode ? ' karşılaştırmaya ekle/çıkar' : ' detayını aç')}
    >
      {/* karşılaştırma seçim göstergesi */}
      {karsMode && (
        <span className={'absolute top-2.5 left-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 ' +
          (secili ? 'bg-violet-600 ring-violet-600 text-white' : 'bg-background ring-border text-transparent')}>
          ✓
        </span>
      )}
      {/* üst satır */}
      <div className="flex items-start gap-2.5">
        <div className={'w-10 h-10 rounded-xl text-white text-[13px] font-extrabold flex items-center justify-center shrink-0 ' + AVATAR[k.cls]}>
          {initials || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="font-bold text-[13.5px] truncate group-hover:text-primary transition-colors">{k.name}</span>
            <ClsBadge cls={k.cls} />
            <StatusBadge
              label={LIFE_LABEL[k.ritim][0]}
              tone={k.ritim === 'ok' ? 'ok' : k.ritim === 'watch' ? 'watch' : k.ritim === 'risk' ? 'risk' : 'neutral'}
            />
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5">
            {nf0.format(k.sefer)} sefer · {nf0.format(k.adet)} araç · pay %{nf1.format(k.pay)}
          </div>
        </div>
        {/* yıllık değişim rozeti */}
        {k.yeniMi ? (
          <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/25">
            Yeni
          </span>
        ) : k.degisim != null ? (
          <span className={'shrink-0 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ' +
            (k.degisim >= 0
              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25'
              : 'bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25')}>
            {k.degisim >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            %{nf1.format(Math.abs(k.degisim))}
            <span className="font-medium opacity-70">vs {k.degPrevYil}</span>
          </span>
        ) : karsMode ? (
          <span className="w-5" />
        ) : null}
      </div>

      {/* ana metrik */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div>
          <div className="text-xl font-extrabold text-foreground leading-none">
            {nf1.format(k.m3)} <span className="text-[11px] font-semibold text-muted-foreground">m³</span>
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-1">ort. {nf1.format(k.ortSefer)} m³/sefer</div>
        </div>
        {/* yıl mini barları */}
        <div className="flex items-end gap-1 h-11 w-[42%] max-w-[150px]">
          {yl.map((y) => (
            <div key={y.yil} className="flex-1 flex flex-col items-center gap-0.5 min-w-0"
              title={y.yil + ': ' + nf1.format(y.m3) + ' m³ · ' + nf0.format(y.sefer) + ' sefer'}>
              <div className={'w-full rounded-t-sm transition-all ' +
                (y.yil === k.degYil ? 'bg-gradient-to-t from-violet-600 to-fuchsia-400' : 'bg-violet-200 dark:bg-violet-800/70')}
                style={{ height: Math.max(6, (y.m3 / yMax) * 30) + 'px' }} />
              <span className="text-[8px] text-muted-foreground leading-none">{String(y.yil).slice(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ekipman tercih çubuğu */}
      <div className="mt-2.5">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
          <div className="bg-violet-500" style={{ width: (k.kompleTIR / ekipTop) * 100 + '%' }} />
          <div className="bg-amber-500" style={{ width: (k.parsiyelTIR / ekipTop) * 100 + '%' }} />
          <div className="bg-pink-500" style={{ width: (k.konteyner / ekipTop) * 100 + '%' }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[9.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Komple TIR %{((k.kompleTIR / ekipTop) * 100).toFixed(0)}</span>
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Parsiyel %{((k.parsiyelTIR / ekipTop) * 100).toFixed(0)}</span>
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-pink-500 inline-block" />Konteyner %{((k.konteyner / ekipTop) * 100).toFixed(0)}</span>
        </div>
      </div>

      {/* son yükleme + en yoğun ay */}
      <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between gap-2 text-[9.5px] text-muted-foreground">
        <span>🕐 Son: <b className="text-foreground/80">{fmtDate(k.sonYukleme) || '—'}</b></span>
        <span>📅 En yoğun: <b className="text-foreground/80">{k.enYogunAy}</b></span>
      </div>
    </button>
  );
}
