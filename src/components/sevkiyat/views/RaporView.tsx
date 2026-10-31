'use client';

/* Detay Raporları: haftalık (bölüm bazında), günlük, tüm kayıtlar */
import { useMemo } from 'react';
import { SectionCard, DataTable } from '../Shared';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { weeklyAgg, dailyList } from '@/lib/sevkiyat/analytics';
import { uniq, nf0, nf1, fmtDate } from '@/lib/sevkiyat/core';
import type { Row } from '@/lib/sevkiyat/types';
import { toast } from '@/hooks/use-toast';
import { exportReports } from '@/lib/sevkiyat/excel';

export default function RaporView() {
  const { data, filters, targets, caps } = useSevkiyat();
  const rows: Row[] = useMemo(() => applyFilters(data, filters), [data, filters]);
  const deps = useMemo(() => uniq(rows.map((r) => r.bolum)).sort(), [rows]);
  const dated = useMemo(() => rows.filter((r) => r.tarih), [rows]);

  const weekly = useMemo(
    () => weeklyAgg(dated).sort((a, b) => b.yil - a.yil || b.hafta - a.hafta),
    [dated]
  );
  const daily = useMemo(() => dailyList(rows).slice().reverse(), [rows]);
  const all = useMemo(
    () => rows.slice().sort((a, b) => (b.tarih?.getTime() ?? 0) - (a.tarih?.getTime() ?? 0)).slice(0, 2000),
    [rows]
  );

  const doExport = () => {
    if (!rows.length) {
      toast({ title: 'Dışa aktarılacak veri yok', variant: 'destructive' });
      return;
    }
    const st = useSevkiyat.getState();
    const fname = exportReports(rows, st.data, st.targets, st.caps, null);
    void targets;
    void caps;
    toast({ title: 'Excel raporu indirildi', description: fname + ' (10 sayfa)' });
  };

  return (
    <div className="space-y-4">
      <SectionCard
        icon={<FileText className="w-4 h-4" />}
        title="🧾 Detay Raporları"
        desc={`Aktif filtre: ${nf0.format(rows.length)} kayıt · ${deps.length} bölüm`}
        action={
          <Button variant="outline" size="sm" onClick={doExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Excel indir
          </Button>
        }
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {filters.year !== 'all' && <Chip l={'Yıl: ' + filters.year} />}
          {filters.week !== 'all' && <Chip l={'Hafta: H' + filters.week.split('|')[1]} />}
          {filters.deps.map((d) => <Chip key={d} l={d} />)}
          {filters.tips.map((t) => <Chip key={t} l={t} />)}
          {(filters.from || filters.to) && <Chip l={'Tarih: ' + (filters.from || '…') + ' – ' + (filters.to || '…')} />}
          {filters.search && <Chip l={'Müşteri: "' + filters.search + '"'} />}
          {filters.year === 'all' && filters.week === 'all' && !filters.from && !filters.to && !filters.deps.length && !filters.tips.length && !filters.search && <Chip l="Tüm kayıtlar" />}
        </div>

        <h4 className="text-[12.5px] font-bold mt-1 mb-1.5">📅 Haftalık Rapor (bölüm bazında m³)</h4>
        <DataTable
          rows={weekly}
          maxHeight={360}
          compact
          cols={[
            { key: 'yil', header: 'Yıl', cell: (w) => w.yil },
            { key: 'h', header: 'Hafta', cell: (w) => <span className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10.5px] font-bold">H{w.hafta}</span> },
            { key: 'rng', header: 'Aralık', cell: (w) => (w.min != null ? fmtDate(new Date(w.min)) + ' – ' + fmtDate(new Date(w.max!)) : '—') },
            { key: 'adet', header: 'Araç', align: 'right', cell: (w) => <b>{nf0.format(w.adet)}</b> },
            { key: 'm3', header: 'm³', align: 'right', cell: (w) => <b>{nf1.format(w.m3)}</b> },
            ...deps.map((d) => ({
              key: 'dep-' + d,
              header: d,
              align: 'right' as const,
              cell: (w: (typeof weekly)[number]) => (w.deps[d] ? nf1.format(w.deps[d]) : <span className="text-border">–</span>),
            })),
          ]}
        />

        <h4 className="text-[12.5px] font-bold mt-4 mb-1.5">🗓 Günlük Rapor</h4>
        <DataTable
          rows={daily}
          maxHeight={320}
          compact
          cols={[
            { key: 't', header: 'Tarih', cell: (x) => fmtDate(x.d) },
            { key: 'g', header: 'Gün', cell: (x) => x.gun },
            { key: 'adet', header: 'Araç', align: 'right', cell: (x) => nf0.format(x.adet) },
            { key: 'm3', header: 'm³', align: 'right', cell: (x) => nf1.format(x.m3) },
            { key: 'avg', header: 'm³/Araç', align: 'right', cell: (x) => (x.adet ? nf1.format(x.m3 / x.adet) : '—') },
          ]}
        />

        <h4 className="text-[12.5px] font-bold mt-4 mb-1.5">📋 Tüm Kayıtlar <span className="text-[10.5px] font-normal text-muted-foreground">(ilk 2.000)</span></h4>
        <DataTable
          rows={all}
          maxHeight={520}
          compact
          cols={[
            { key: 'i', header: '#', width: '44px', cell: (_r, i) => i + 1 },
            { key: 't', header: 'Tarih', cell: (r) => r.tarihStr || <span className="rounded-md bg-red-500/12 text-red-600 dark:text-red-400 px-1.5 py-0.5 text-[10px] font-bold">tarihsiz</span> },
            { key: 'g', header: 'Gün', cell: (r) => r.gun || '—' },
            { key: 'm', header: 'Müşteri', cell: (r) => <b>{r.musteri}</b> },
            { key: 'b', header: 'Bölüm', cell: (r) => r.bolum },
            { key: 'k', header: 'Kategori', cell: (r) => r.kategori || '—' },
            { key: 'tip', header: 'Tip', cell: (r) => r.tip },
            { key: 'a', header: 'Adet', align: 'right', cell: (r) => nf0.format(r.adet) },
            { key: 'm3', header: 'm³', align: 'right', cell: (r) => nf1.format(r.m3) },
          ]}
        />
      </SectionCard>
    </div>
  );
}

function Chip({ l }: { l: string }) {
  return <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-semibold">{l}</span>;
}
