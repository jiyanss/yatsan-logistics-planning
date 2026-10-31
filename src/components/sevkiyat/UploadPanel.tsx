'use client';

/* Excel Yükleme paneli: sürükle-bırak, birleştir/değiştir, kolon eşleştirme, teşhis, senkron durumu */
import { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  UploadCloud, FileUp, Settings2, Sparkles, FileDown, Stethoscope, Trash2, RefreshCw,
  CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { detectHeader, rowsFromSheet, sheetAoa, autoParse, importTargetsFromWb, downloadTemplate, fileStat, FIELD_DEFS, type HeaderDetect } from '@/lib/sevkiyat/excel';
import { colLetter, nf0, fmtDate, pad2 } from '@/lib/sevkiyat/core';
import { parseDate, serialToParts } from '@/lib/sevkiyat/dates';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { Row } from '@/lib/sevkiyat/types';

type Cols = Record<string, string>;

export default function UploadPanel() {
  const { data, applyRows, clearAll, fullReload, syncState, targets, importTargetsLocal, demoMode, filters } = useSevkiyat();
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [stat, setStat] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [merge, setMerge] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = fileStat(data);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      setBusy(true);
      try {
        let workbook: XLSX.WorkBook;
        if (/\.csv$/i.test(file.name)) {
          const buf = await file.arrayBuffer();
          let txt = new TextDecoder('utf-8').decode(buf);
          if (txt.indexOf('\uFFFD') >= 0) txt = new TextDecoder('windows-1254').decode(buf);
          workbook = XLSX.read(txt, { type: 'string' });
        } else {
          const buf = await file.arrayBuffer();
          workbook = XLSX.read(new Uint8Array(buf), { type: 'array' });
        }
        setWb(workbook);
        setFileName(file.name);

        // HEDEF sayfası içe aktarımı
        const tRes = importTargetsFromWb(workbook, targets);
        if (tRes.count > 0) {
          importTargetsLocal(tRes.targets);
          toast({ title: '🎯 ' + tRes.count + ' aylık hedef alındı' });
        }

        const res = autoParse(workbook);
        console.log('[Sevkiyat] Sayfalar:', res.used, '· satır:', res.rows.length);
        if (res.rows.length) {
          await applyRows(res.rows, res.used.join(', '), file.name, merge);
          const stNow = fileStat(useSevkiyat.getState().data);
          setStat(
            '✅ ' + file.name + ' · ' + res.used.join(', ') + '\n' +
            nf0.format(res.rows.length) + ' satır işlendi · toplam ' + nf0.format(useSevkiyat.getState().data.length) + ' kayıt\n' +
            '📅 ' + stNow.range + (stNow.noDate ? ' · ' + stNow.noDate + ' tarihsiz' : '')
          );
          toast({ title: res.rows.length + ' kayıt işlendi', description: 'Toplam ' + nf0.format(useSevkiyat.getState().data.length) + ' kayıt' });
        } else if (tRes.count === 0) {
          setMapperOpen(true);
          toast({ title: 'Otomatik tanıma başarısız', description: 'Kolonları elle eşleştirin', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Dosya okunamadı', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      } finally {
        setBusy(false);
      }
    },
    [applyRows, importTargetsLocal, merge, targets]
  );

  const doClear = async () => {
    if (!confirm('Firebase dahil TÜM veriler silinecek. Emin misiniz?')) return;
    await clearAll();
    setStat('');
    toast({ title: 'Veriler temizlendi' });
  };

  const loadSample = async () => {
    // Eski panelin örnek veri davranışı: küçük demo seti Firebase'e yazılır
    const { buildDemoData } = await import('@/lib/sevkiyat/demo');
    const rows = buildDemoData().slice(0, 200);
    await applyRows(rows, 'örnek veri', 'demo', false);
    toast({ title: 'Örnek veri yüklendi', description: nf0.format(rows.length) + ' kayıt' });
  };

  const rows = applyFilters(data, filters);

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px] flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </span>
            Excel Yükleme & Veri Durumu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFile(e.dataTransfer.files[0]); }}
              className={cn(
                'flex-1 min-h-[150px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-center p-6 cursor-pointer transition-colors',
                dragOver ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/60'
              )}
            >
              {busy ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <FileUp className="w-8 h-8" />}
              <b className="text-[13.5px]">Excel dosyasını sürükleyin veya tıklayın</b>
              <span className="text-[11.5px] leading-relaxed">
                Sadece değişen kayıtlar Firebase'e yazılır · açılışlar önbellekten yapılır (kota dostu)
              </span>
            </div>

            <div className="md:w-[300px] flex flex-col gap-2.5">
              <label className="flex items-start gap-2 text-[12px] text-muted-foreground cursor-pointer">
                <Checkbox checked={merge} onCheckedChange={(v) => setMerge(v === true)} className="mt-0.5" />
                <span>Mevcut verilerle <b className="text-foreground">birleştir</b><br />(işaretsiz: dosyada olmayanlar Firebase'den SİLİNİR)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp className="w-3.5 h-3.5 mr-1.5" />Dosya Seç</Button>
                <Button variant="outline" size="sm" onClick={() => setMapperOpen(true)} disabled={!wb}><Settings2 className="w-3.5 h-3.5 mr-1.5" />Kolon Eşleştir</Button>
                <Button variant="outline" size="sm" onClick={() => void loadSample()}><Sparkles className="w-3.5 h-3.5 mr-1.5" />Örnek Veri</Button>
                <Button variant="outline" size="sm" onClick={downloadTemplate}><FileDown className="w-3.5 h-3.5 mr-1.5" />Şablon</Button>
                <Button variant="outline" size="sm" onClick={() => setDiagOpen(true)} disabled={!wb}><Stethoscope className="w-3.5 h-3.5 mr-1.5" />Teşhis</Button>
                <Button variant="outline" size="sm" onClick={() => void fullReload()} disabled={demoMode}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Yenile</Button>
                <Button variant="destructive" size="sm" onClick={() => void doClear()}><Trash2 className="w-3.5 h-3.5 mr-1.5" />Temizle</Button>
              </div>
              <div className="rounded-lg border bg-accent/40 px-3 py-2.5 text-[11.5px] leading-relaxed whitespace-pre-line min-h-[64px]">
                {stat || 'Henüz veri yüklenmedi.'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
            <StatBox label="Toplam Kayıt" value={nf0.format(data.length)} />
            <StatBox label="Filtrede" value={nf0.format(rows.length)} />
            <StatBox label="Tarih Aralığı" value={st.range} />
            <StatBox label="Tarihsiz" value={st.noDate ? st.noDate + ' kayıt' : '—'} warn={st.noDate > 0} />
            <StatBox label="Senkron" value={demoMode ? 'Demo modu' : syncState === 'synced' ? 'Firebase ✓' : syncState === 'saving' ? 'Yazılıyor…' : syncState === 'offline' ? 'Çevrimdışı' : 'Bağlanıyor…'} warn={syncState === 'offline'} />
            <StatBox label="Hedef Ay" value={String(Object.keys(targets).length)} />
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />

      {wb && <MapperDialog open={mapperOpen} onClose={() => setMapperOpen(false)} wb={wb} fileName={fileName} onApply={async (rws, sheet) => {
        setMapperOpen(false);
        await applyRows(rws, sheet, fileName || 'manuel eşleştirme', merge);
        toast({ title: rws.length + ' kayıt işlendi (manuel eşleştirme)' });
      }} />}

      {wb && <DiagDialog open={diagOpen} onClose={() => setDiagOpen(false)} wb={wb} />}
    </div>
  );
}

function StatBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className={cn('font-bold text-[13px] truncate', warn && 'text-red-600 dark:text-red-400')}>{value || '—'}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

/* ---------- Kolon eşleştirme diyaloğu ---------- */

function MapperDialog({
  open, onClose, wb, fileName, onApply,
}: {
  open: boolean;
  onClose: () => void;
  wb: XLSX.WorkBook;
  fileName: string;
  onApply: (rows: Row[], sheet: string) => Promise<void>;
}) {
  const [sheet, setSheet] = useState(wb.SheetNames[0] || '');
  const [headRow, setHeadRow] = useState('1');
  const [cols, setCols] = useState<Cols>({});

  const aoa = sheet ? sheetAoa(wb, sheet) : [];
  const hi = Math.max(0, (parseInt(headRow) || 1) - 1);
  const headers = aoa[hi] || [];

  // sayfa/başlık değişince otomatik tespit uygula
  const auto: HeaderDetect = useMemoDetect(wb, sheet, hi, open);

  const rowsPreview = useMemoRows(aoa, hi, cols, auto);

  const setCol = (field: string, colIdx: string) => {
    setCols((prev) => {
      const next: Cols = {};
      Object.keys(prev).forEach((k) => {
        if (prev[k] !== field) next[k] = prev[k];
      });
      if (colIdx !== '') next[colIdx] = field;
      return next;
    });
  };

  const currentFor = (field: string): string => {
    const found = Object.keys(cols).find((k) => cols[k] === field);
    return found ?? Object.keys(auto.cols).find((k) => auto.cols[k] === field) ?? '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="text-base">⚙️ Kolon Eşleştirme</DialogTitle>
        </DialogHeader>
        <p className="text-[11.5px] text-muted-foreground">Dosya: {fileName || 'son yüklenen dosya'} — Müşteri zorunlu.</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[10.5px] uppercase font-bold text-muted-foreground">Çalışma Sayfası</span>
            <Select value={sheet} onValueChange={(v) => { setSheet(v); setCols({}); setHeadRow(String(detectHeader(sheetAoa(wb, v)).idx + 1)); }}>
              <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{wb.SheetNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[10.5px] uppercase font-bold text-muted-foreground">Başlık Satır No</span>
            <Input type="number" min={1} max={100} value={headRow} onChange={(e) => { setHeadRow(e.target.value); setCols({}); }} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FIELD_DEFS.map((f) => (
            <div key={f.key} className="space-y-1">
              <span className="text-[10.5px] uppercase font-bold text-muted-foreground">{f.label}{f.req ? ' *' : ''}</span>
              <Select value={currentFor(f.key)} onValueChange={(v) => setCol(f.key, v)}>
                <SelectTrigger size="sm" className="w-full"><SelectValue placeholder="— boş —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty">— boş —</SelectItem>
                  {headers.map((h, c) => (
                    <SelectItem key={c} value={String(c)}>{colLetter(c)}: {String(h == null ? '' : h).trim().slice(0, 26) || '(boş)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className={cn('rounded-lg px-3 py-2 text-[12px]', rowsPreview.length ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-600 dark:text-red-400')}>
          {rowsPreview.length ? (
            <span>✅ <b>{rowsPreview.length}</b> satır · Örnek: {rowsPreview.slice(0, 3).map((r) => (r.musteri || '?') + ' · ' + r.adet + ' adet · ' + (r.tarihStr || 'tarihsiz')).join(' | ')}</span>
          ) : (
            <span>⚠ Satır bulunamadı.</span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button
            disabled={!rowsPreview.length}
            onClick={() => void onApply(rowsPreview, sheet)}
          >
            ✔ Bu Eşlemeyle Yükle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useMemoDetect(wb: XLSX.WorkBook, sheet: string, hi: number, open: boolean): HeaderDetect {
  return useMemo(() => {
    if (!open || !sheet) return { idx: -1, score: 0, cols: {} };
    const det = detectHeader(sheetAoa(wb, sheet));
    void hi;
    return det;
  }, [wb, sheet, open, hi]);
}

function useMemoRows(aoa: unknown[][], hi: number, cols: Cols, auto: HeaderDetect): Row[] {
  return useMemo(() => {
    const merged: Cols = { ...auto.cols, ...cols };
    const clean: Cols = {};
    Object.keys(merged).forEach((k) => {
      if (merged[k] !== 'empty' && merged[k]) clean[k] = merged[k];
    });
    if (!Object.keys(clean).length) return [];
    return rowsFromSheet(aoa, hi, clean);
  }, [aoa, hi, cols, auto]);
}

/* ---------- Teşhis diyaloğu ---------- */

function DiagDialog({ open, onClose, wb }: { open: boolean; onClose: () => void; wb: XLSX.WorkBook }) {
  function rawCellDesc(v: unknown): string {
    if (v == null || v === '') return '(boş)';
    if (v instanceof Date) return 'Tarih → ' + v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) {
        const p = serialToParts(v);
        return p ? 'Seri no → ' + v + ' (= ' + p.d + '.' + p.mo + '.' + p.y + ')' : 'Seri no → ' + v;
      }
      return 'Sayı → ' + v;
    }
    return 'Metin → "' + String(v) + '"';
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="text-base">🔍 Excel Yükleme Teşhisi</DialogTitle>
        </DialogHeader>
        <p className="text-[11.5px] text-muted-foreground">Tarih tablosu ve etiket denetimi.</p>
        {wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          if (!ws || !ws['!ref']) return null;
          const aoa = sheetAoa(wb, name);
          const det = detectHeader(aoa);
          const dCol = Object.keys(det.cols).find((k) => det.cols[k] === 'tarih');
          const sample: { i: number; raw: string; parsed: string; ok: boolean }[] = [];
          if (dCol != null) {
            let shown = 0;
            for (let i = det.idx + 1; i < aoa.length && shown < 12; i++) {
              const r = aoa[i];
              if (!r) continue;
              if (!r.some((x) => x !== '' && x != null)) continue;
              shown++;
              const raw = r[+dCol];
              const p = parseDate(raw);
              sample.push({ i: i + 1, raw: rawCellDesc(raw), parsed: p ? fmtDate(p) : '—', ok: !!p });
            }
          }
          const rowCount = det.idx >= 0 ? rowsFromSheet(aoa, det.idx, det.cols).length : 0;
          return (
            <div key={name} className="rounded-lg border p-3 space-y-2">
              <div className="font-bold text-[13px]">📄 {name}</div>
              {det.idx < 0 ? (
                <div className="text-[12px] text-red-600 dark:text-red-400">❌ Başlık tanınamadı.</div>
              ) : (
                <>
                  <div className="text-[11.5px] text-muted-foreground">
                    Başlık: {det.idx + 1} ·{' '}
                    {Object.keys(det.cols).map((k) => colLetter(+k) + ' → ' + (FIELD_DEFS.find((f) => f.key === det.cols[k])?.label || '?')).join(' · ') || 'yok'}
                  </div>
                  {sample.length > 0 && (
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left py-1">Satır</th>
                          <th className="text-left py-1">Ham Değer</th>
                          <th className="text-left py-1">Yorum</th>
                          <th className="py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {sample.map((s) => (
                          <tr key={s.i} className="border-t">
                            <td className="py-1">{s.i}</td>
                            <td className="py-1">{s.raw}</td>
                            <td className="py-1 font-semibold">{s.parsed}</td>
                            <td className="py-1 text-right">{s.ok ? '✅' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
                    {rowCount > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    Okunan satır: <b>{rowCount}</b>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
