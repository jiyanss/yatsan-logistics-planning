'use client';

/* Kullanıcı Yönetimi (yalnızca yönetici):
   Üye onayları, roller ve erişim durumu. Bekleyen kayıtlar üstte listelenir;
   Onayla / Reddet / Beklemeye al aksiyonları canlı çalışır (RTDB dinleyici). */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SectionCard, DataTable, StatusBadge, EmptyState } from '../Shared';
import { useSevkiyat } from '@/lib/sevkiyat/store';
import { fbWatchKullanicilar, fbSetDurum, type KullaniciSatiri } from '@/lib/sevkiyat/firebase';
import { nf0, fmtDate } from '@/lib/sevkiyat/core';
import { UsersRound, Clock, CheckCircle2, ShieldX, Undo2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { KullaniciKaydi } from '@/lib/sevkiyat/types';

const DURUM_SIRA: Record<KullaniciKaydi['durum'], number> = { bekliyor: 0, reddedildi: 1, onayli: 2 };

export default function KullanicilarView() {
  const { yetki, demoMode } = useSevkiyat();
  const [list, setList] = useState<KullaniciSatiri[] | null>(null);
  const [islem, setIslem] = useState<string>('');

  useEffect(() => {
    if (yetki !== 'admin') return;
    if (demoMode) { setList([]); return; }
    const stop = fbWatchKullanicilar((l) => setList(l));
    return () => stop();
  }, [yetki, demoMode]);

  const sirali = useMemo(() => {
    if (!list) return [];
    return [...list].sort((a, b) =>
      (DURUM_SIRA[a.k.durum] - DURUM_SIRA[b.k.durum]) ||
      (b.k.istekTarihi || 0) - (a.k.istekTarihi || 0) ||
      a.k.email.localeCompare(b.k.email, 'tr')
    );
  }, [list]);

  const nBekleyen = (list || []).filter((x) => x.k.durum === 'bekliyor').length;
  const nOnayli = (list || []).filter((x) => x.k.durum === 'onayli').length;
  const nRed = (list || []).filter((x) => x.k.durum === 'reddedildi').length;

  const guncelle = async (uid: string, email: string, durum: KullaniciKaydi['durum']) => {
    setIslem(uid + ':' + durum);
    try {
      await fbSetDurum(uid, durum);
      toast({
        title: durum === 'onayli' ? '✓ Onaylandı' : durum === 'reddedildi' ? 'Reddedildi' : 'Beklemeye alındı',
        description: email + ' → ' + (durum === 'onayli' ? 'yazma yetkisi verildi' : durum === 'reddedildi' ? 'salt okunur (red)' : 'onay bekliyor'),
      });
    } catch (e) {
      toast({ title: 'Güncellenemedi', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setIslem('');
    }
  };

  if (yetki !== 'admin') {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <EmptyState
          icon={<ShieldX className="w-6 h-6" />}
          title="Bu sayfa yalnızca yöneticiye açıktır"
          desc="Kullanıcı onayları için yönetici hesabıyla giriş yapın."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Özet şerit */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Ozet renk="violet" ikon={<UsersRound className="w-4 h-4" />} deger={nf0.format((list || []).length)} etiket="Toplam üye" />
        <Ozet renk="amber" ikon={<Clock className="w-4 h-4" />} deger={nf0.format(nBekleyen)} etiket="Onay bekleyen" uyari={nBekleyen > 0} />
        <Ozet renk="emerald" ikon={<CheckCircle2 className="w-4 h-4" />} deger={nf0.format(nOnayli)} etiket="Onaylı / yetkili" />
        <Ozet renk="red" ikon={<ShieldX className="w-4 h-4" />} deger={nf0.format(nRed)} etiket="Reddedilen" />
      </div>

      <SectionCard
        icon={<UsersRound className="w-4 h-4" />}
        title="👥 Üyeler"
        desc={demoMode
          ? 'Demo modunda gerçek kullanıcı listesi gösterilmez — Firebase\u2019e geçince canlı listelenir.'
          : 'Bekleyen kayıtlar üstte. Onaylanan üye Excel yükleyip verileri güncelleyebilir; bekleyen/reddedilen yalnızca izler.'}
      >
        {list === null ? (
          <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Kullanıcılar yükleniyor…
          </div>
        ) : sirali.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            {demoMode ? 'Demo modu — kullanıcı listesi yok.' : 'Henüz kayıtlı üye yok. Panelde \u201CKayıt ol\u201D ile ilk üyeler oluşur.'}
          </div>
        ) : (
          <DataTable
            rows={sirali}
            maxHeight={560}
            cols={[
              {
                key: 'email', header: 'E-posta',
                cell: (x) => (
                  <span className="font-medium truncate block max-w-[280px]" title={x.k.email}>{x.k.email || '(e-posta yok)'}</span>
                ),
              },
              {
                key: 'rol', header: 'Rol',
                cell: (x) => x.k.rol === 'admin'
                  ? <StatusBadge tone="up" label="Yönetici" />
                  : <span className="text-[11px] text-muted-foreground">Üye</span>,
              },
              {
                key: 'durum', header: 'Durum',
                cell: (x) => x.k.durum === 'onayli'
                  ? <StatusBadge tone="ok" label="Onaylı" />
                  : x.k.durum === 'bekliyor'
                    ? <StatusBadge tone="watch" label="Bekliyor" />
                    : <StatusBadge tone="risk" label="Reddedildi" />,
              },
              {
                key: 'istek', header: 'Kayıt / İstek', align: 'right',
                cell: (x) => <span className="tabular-nums">{x.k.istekTarihi ? fmtDate(new Date(x.k.istekTarihi)) : '—'}</span>,
              },
              {
                key: 'onay', header: 'Onay', align: 'right',
                cell: (x) => <span className="tabular-nums">{x.k.onayTarihi ? fmtDate(new Date(x.k.onayTarihi)) : '—'}</span>,
              },
              {
                key: 'islem', header: 'İşlem', align: 'right',
                cell: (x) => {
                  const busy = islem !== '';
                  return (
                    <div className="flex justify-end gap-1.5">
                      {x.k.durum !== 'onayli' && (
                        <Button size="sm" className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={busy || demoMode}
                          onClick={() => void guncelle(x.uid, x.k.email, 'onayli')}>
                          {islem === x.uid + ':onayli' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Onayla
                        </Button>
                      )}
                      {x.k.durum !== 'reddedildi' && (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] text-red-600 dark:text-red-400 border-red-500/40 hover:bg-red-500/10"
                          disabled={busy || demoMode}
                          onClick={() => void guncelle(x.uid, x.k.email, 'reddedildi')}>
                          {islem === x.uid + ':reddedildi' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldX className="w-3 h-3" />}
                          Reddet
                        </Button>
                      )}
                      {x.k.durum !== 'bekliyor' && (
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-[11px]"
                          disabled={busy || demoMode}
                          onClick={() => void guncelle(x.uid, x.k.email, 'bekliyor')}>
                          <Undo2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </SectionCard>

      <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-[11.5px] text-muted-foreground leading-relaxed">
        <b className="text-foreground">Nasıl çalışır?</b> Yeni kayıt olan üye <b>onay bekliyor</b> durumunda başlar ve paneli
        misafir gibi salt okunur gezer. Yönetici onay verince yazma yetkisi (Excel yükleme, düzenleme, silme) anında açılır.
        Kural katmanında da yazma yetkisi yalnızca onaylı hesaplara verildiği için bu sınır istemciyi atlayan denemelere karşı da geçerlidir.
      </div>
    </div>
  );
}

function Ozet({ renk, ikon, deger, etiket, uyari }: {
  renk: 'violet' | 'amber' | 'emerald' | 'red';
  ikon: React.ReactNode;
  deger: string;
  etiket: string;
  uyari?: boolean;
}) {
  const map = {
    violet: 'from-violet-500 to-purple-500',
    amber: 'from-amber-500 to-orange-500',
    emerald: 'from-emerald-500 to-teal-500',
    red: 'from-red-500 to-rose-500',
  } as const;
  return (
    <div className={cn('rounded-xl border bg-card shadow-sm p-3 flex items-center gap-2.5', uyari && 'ring-2 ring-amber-500/40')}>
      <span className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shrink-0', map[renk])}>{ikon}</span>
      <div className="min-w-0">
        <div className="text-[17px] font-extrabold leading-tight tracking-tight">{deger}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{etiket}</div>
      </div>
    </div>
  );
}
