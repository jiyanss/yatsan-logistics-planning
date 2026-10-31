'use client';

/* Hedef düzenleyici diyaloğu — yıl seç, 12 ay gir, Firebase'e kaydet */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSevkiyat } from '@/lib/sevkiyat/store';
import { AYLAR_UZUN, pad2, uniq, toNum } from '@/lib/sevkiyat/core';
import type { Targets } from '@/lib/sevkiyat/types';
import { toast } from '@/hooks/use-toast';

export default function TargetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, targets } = useSevkiyat();
  const years = uniq(data.map((r) => r.yil).filter((y): y is number => !!y).concat([new Date().getFullYear()])).sort((a, b) => b - a);
  const [year, setYear] = useState<string>(String(years[0] ?? new Date().getFullYear()));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">🎯 Aylık Hedefler</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Yıl:</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {/* Yıl değişince form yeniden kurulur */}
        <TargetForm key={open + '-' + year} year={year} targets={targets} onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function TargetForm({ year, targets, onDone }: { year: string; targets: Targets; onDone: () => void }) {
  const { saveTargets, demoMode } = useSevkiyat();
  const [vals, setVals] = useState<Record<string, { adet: string; m3: string }>>(() => {
    const v: Record<string, { adet: string; m3: string }> = {};
    for (let m = 1; m <= 12; m++) {
      const ym = year + '-' + pad2(m);
      const t = targets[ym];
      v[ym] = { adet: t?.adet ? String(t.adet) : '', m3: t?.m3 ? String(t.m3) : '' };
    }
    return v;
  });

  const save = async () => {
    const next = JSON.parse(JSON.stringify(targets)) as typeof targets;
    Object.keys(vals).forEach((ym) => {
      const adet = toNum(vals[ym].adet);
      const m3 = toNum(vals[ym].m3);
      if (!adet && !m3) delete next[ym];
      else next[ym] = { adet, m3 };
    });
    const ok = await saveTargets(next);
    if (ok) toast({ title: 'Hedefler kaydedildi ✓', description: demoMode ? 'Demo modunda yerelde tutuldu' : 'Firebase meta/targets güncellendi' });
    else toast({ title: "Hedefler Firebase'e yazılamadı", description: 'Yerelde kaydedildi, çevrimiçi olunca tekrar deneyin', variant: 'destructive' });
    onDone();
  };

  return (
    <>
      <div className="max-h-[340px] overflow-y-auto nice-scroll rounded-lg border">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="text-left px-2.5 py-2 text-[10.5px] uppercase text-muted-foreground">Ay</th>
              <th className="text-right px-2.5 py-2 text-[10.5px] uppercase text-muted-foreground">Araç Hedef</th>
              <th className="text-right px-2.5 py-2 text-[10.5px] uppercase text-muted-foreground">m³ Hedef</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const ym = year + '-' + pad2(m);
              return (
                <tr key={m} className="border-t">
                  <td className="px-2.5 py-1.5 font-medium">{AYLAR_UZUN[m - 1]}</td>
                  <td className="px-2 py-1"><Input className="h-7 text-right text-[12px]" type="number" min={0} value={vals[ym]?.adet ?? ''} onChange={(e) => setVals({ ...vals, [ym]: { ...(vals[ym] || { m3: '' }), adet: e.target.value } })} placeholder="—" /></td>
                  <td className="px-2 py-1"><Input className="h-7 text-right text-[12px]" type="number" min={0} value={vals[ym]?.m3 ?? ''} onChange={(e) => setVals({ ...vals, [ym]: { ...(vals[ym] || { adet: '' }), m3: e.target.value } })} placeholder="—" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Vazgeç</Button>
        <Button onClick={() => void save()}>Kaydet</Button>
      </div>
    </>
  );
}
