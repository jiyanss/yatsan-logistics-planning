'use client';

/* Gelişmiş filtre barı: dönem, yıl/hafta, hızlı aralıklar, arama, bölüm/tip çipleri, presetler */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Filter, RotateCcw, Save, Search, X, Bookmark } from 'lucide-react';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { uniq, pad2 } from '@/lib/sevkiyat/core';
import type { FilterState } from '@/lib/sevkiyat/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function FilterBar() {
  const { data, filters, setFilters, resetFilters, presets, savePreset, applyPreset, deletePreset } = useSevkiyat();
  const [open, setOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [selPreset, setSelPreset] = useState('');

  const years = useMemo(
    () => uniq(data.map((r) => r.yil).filter((y): y is number => !!y)).sort((a, b) => b - a),
    [data]
  );
  const weeks = useMemo(() => {
    const rows = filters.year !== 'all' ? data.filter((r) => String(r.yil) === filters.year) : data.filter((r) => r.hafta);
    const set = uniq(rows.filter((r) => r.hafta).map((r) => r.yil + '|' + r.hafta));
    return set.sort((a, b) => {
      const pa = a.split('|'), pb = b.split('|');
      return +pa[0] - +pb[0] || +pa[1] - +pb[1];
    });
  }, [data, filters.year]);

  const deps = useMemo(() => uniq(data.map((r) => r.bolum)).sort(), [data]);
  const tips = useMemo(() => uniq(data.map((r) => r.tip)).sort(), [data]);

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);

  const activeCount =
    (filters.year !== 'all' ? 1 : 0) +
    (filters.week !== 'all' ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0) +
    (filters.search ? 1 : 0) +
    filters.deps.length +
    filters.tips.length;

  const toggleIn = (field: 'deps' | 'tips', v: string) => {
    const cur = filters[field];
    setFilters({ [field]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<FilterState>);
  };

  const quick = (kind: string) => {
    // referans: verideki en son tarih
    const ts = data.filter((r) => r.tarih).map((r) => r.tarih!.getTime());
    if (!ts.length && kind !== 'all') {
      toast({ title: 'Önce veri yükleyin', variant: 'destructive' });
      return;
    }
    const ref = ts.length ? new Date(Math.max(...ts)) : null;
    let f = '', t = '';
    if (ref) {
      const d = (n: number) => {
        const x = new Date(ref);
        x.setDate(x.getDate() + n);
        return x;
      };
      if (kind === '7') { f = iso(d(-6)); t = iso(ref); }
      else if (kind === '30') { f = iso(d(-29)); t = iso(ref); }
      else if (kind === 'm') { f = iso(new Date(ref.getFullYear(), ref.getMonth(), 1)); t = iso(ref); }
      else if (kind === 'pm') { f = iso(new Date(ref.getFullYear(), ref.getMonth() - 1, 1)); t = iso(new Date(ref.getFullYear(), ref.getMonth(), 0)); }
      else if (kind === 'y') { f = iso(new Date(ref.getFullYear(), 0, 1)); t = iso(ref); }
    }
    setFilters({ from: f, to: t });
  };

  const iso = (d: Date) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

  return (
    <Card className="border-border/70 shadow-sm no-print">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardContent className="py-2.5 px-4 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0">
              <Filter className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold text-[13.5px]">Filtreler</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-primary text-primary-foreground text-[10.5px] font-bold px-2 py-0.5">{activeCount}</span>
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">· {filtered.length.toLocaleString('tr-TR')} kayıt</span>
            <span className="ml-auto text-muted-foreground">
              <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
            </span>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-1 pb-4 px-4 space-y-3.5 border-t">
            {/* Aktif çipler */}
            {activeCount > 0 && <ActiveChips />}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Yıl</Label>
                <Select value={filters.year} onValueChange={(v) => setFilters({ year: v, week: 'all' })}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Hafta</Label>
                <Select value={filters.week} onValueChange={(v) => setFilters({ week: v })}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {weeks.map((w) => {
                      const p = w.split('|');
                      return <SelectItem key={w} value={w}>{filters.year === 'all' ? p[0] + ' / ' : ''}Hafta {p[1]}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Başlangıç</Label>
                <Input type="date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Bitiş</Label>
                <Input type="date" value={filters.to} onChange={(e) => setFilters({ to: e.target.value })} className="h-9" />
              </div>
            </div>

            {/* Hızlı aralıklar + arama */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  placeholder="Müşteri adına göre ara…"
                  className="pl-8 h-9"
                />
              </div>
              {[['7', '7 gün'], ['30', '30 gün'], ['m', 'Bu ay'], ['pm', 'Geçen ay'], ['y', 'Bu yıl']].map(([k, l]) => (
                <Button key={k} variant="secondary" size="sm" className="h-9 rounded-full text-xs" onClick={() => quick(k)}>{l}</Button>
              ))}
              <Button variant="ghost" size="sm" className="h-9 rounded-full text-xs" onClick={() => setFilters({ from: '', to: '' })}>Tarihi temizle</Button>
            </div>

            {/* Bölüm & tip çipleri */}
            <ChipRow label="Bölüm" values={deps} selected={filters.deps} onToggle={(v) => toggleIn('deps', v)} />
            <ChipRow label="Tip" values={tips} selected={filters.tips} onToggle={(v) => toggleIn('tips', v)} />

            {/* Presetler */}
            <div className="flex flex-wrap items-end gap-2 pt-1 border-t">
              <div className="space-y-1">
                <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Filtre setini kaydet</Label>
                <div className="flex gap-2">
                  <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Set adı" className="h-9 w-40" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      if (savePreset(presetName)) {
                        toast({ title: '"' + presetName + '" kaydedildi' });
                        setPresetName('');
                      } else toast({ title: 'Önce set adı girin', variant: 'destructive' });
                    }}
                  >
                    <Save className="w-3.5 h-3.5 mr-1" /> Kaydet
                  </Button>
                </div>
              </div>
              {presets.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Kayıtlı setler</Label>
                  <div className="flex gap-2">
                    <Select value={selPreset} onValueChange={(v) => { setSelPreset(v); applyPreset(+v); }}>
                      <SelectTrigger size="sm" className="w-44"><SelectValue placeholder="— seç —" /></SelectTrigger>
                      <SelectContent>
                        {presets.map((p, i) => (
                          <SelectItem key={i} value={String(i)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (selPreset === '') {
                          toast({ title: 'Önce listeden set seçin', variant: 'destructive' });
                          return;
                        }
                        deletePreset(+selPreset);
                        setSelPreset('');
                        toast({ title: 'Set silindi' });
                      }}
                    >
                      Sil
                    </Button>
                  </div>
                </div>
              )}
              <div className="ml-auto">
                <Button variant="outline" size="sm" className="h-9" onClick={resetFilters}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Sıfırla
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ChipRow({ label, values, selected, onToggle }: { label: string; values: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (!values.length) return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground w-14 shrink-0 pt-1.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => {
          const on = selected.includes(v);
          return (
            <button
              key={v}
              onClick={() => onToggle(v)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11.5px] font-medium border transition-colors cursor-pointer',
                on
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary'
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveChips() {
  const { filters, setFilters } = useSevkiyat();
  const chips: { k: string; l: string; clear: () => void }[] = [];
  if (filters.year !== 'all') chips.push({ k: 'y', l: 'Yıl: ' + filters.year, clear: () => setFilters({ year: 'all', week: 'all' }) });
  if (filters.week !== 'all') chips.push({ k: 'w', l: 'Hafta: H' + filters.week.split('|')[1], clear: () => setFilters({ week: 'all' }) });
  filters.deps.forEach((d) => chips.push({ k: 'dep:' + d, l: d, clear: () => setFilters({ deps: filters.deps.filter((x) => x !== d) }) }));
  filters.tips.forEach((t) => chips.push({ k: 'tip:' + t, l: t, clear: () => setFilters({ tips: filters.tips.filter((x) => x !== t) }) }));
  if (filters.from || filters.to) chips.push({ k: 'date', l: (filters.from || '…') + ' – ' + (filters.to || '…'), clear: () => setFilters({ from: '', to: '' }) });
  if (filters.search) chips.push({ k: 'q', l: '"' + filters.search + '"', clear: () => setFilters({ search: '' }) });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Bookmark className="w-3 h-3 text-muted-foreground" />
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mr-1">Aktif:</span>
      {chips.map((c) => (
        <span key={c.k} className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground pl-2.5 pr-1 py-0.5 text-[11px] font-semibold">
          {c.l}
          <button onClick={c.clear} className="w-4 h-4 rounded-full bg-white/25 hover:bg-white/45 flex items-center justify-center cursor-pointer" title="Kaldır">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
