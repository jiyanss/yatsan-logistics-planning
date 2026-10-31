'use client';

/* YATSAN İhracat Yükleme Paneli — ana sayfa (tek sayfa uygulama) */
import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoginGate from '@/components/sevkiyat/LoginGate';
import Shell from '@/components/sevkiyat/Shell';
import FilterBar from '@/components/sevkiyat/FilterBar';
import Overview from '@/components/sevkiyat/Overview';
import UploadPanel from '@/components/sevkiyat/UploadPanel';
import GenelView from '@/components/sevkiyat/views/GenelView';
import AylikView from '@/components/sevkiyat/views/AylikView';
import KarsilastirmaView from '@/components/sevkiyat/views/KarsilastirmaView';
import MusView from '@/components/sevkiyat/views/MusView';
import YasamView from '@/components/sevkiyat/views/YasamView';
import ParsiyelView from '@/components/sevkiyat/views/ParsiyelView';
import KapasiteView from '@/components/sevkiyat/views/KapasiteView';
import HedefView from '@/components/sevkiyat/views/HedefView';
import RaporView from '@/components/sevkiyat/views/RaporView';
import { VIEW_TITLES } from '@/components/sevkiyat/nav';
import { useSevkiyat, applyFilters } from '@/lib/sevkiyat/store';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/sevkiyat/Shared';
import { UploadCloud } from 'lucide-react';

export default function Page() {
  const { view, initAuth, bootDone, data, demoMode, user, filters } = useSevkiyat();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const rows = useMemo(() => applyFilters(data, filters), [data, filters]);

  const booting = !demoMode && !!user && !bootDone;
  const meta = VIEW_TITLES[view];

  return (
    <LoginGate>
      <Shell>
        {/* Görünüm başlığı */}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight">{meta.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.sub}</p>
          </div>
          {view !== 'overview' && view !== 'veri' && (
            <div className="text-[11.5px] text-muted-foreground">
              {rows.length.toLocaleString('tr-TR')} kayıt filtrede
            </div>
          )}
        </div>

        {view !== 'veri' && <FilterBar />}

        {booting ? (
          <BootSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {view === 'overview' && (data.length ? <Overview /> : <NoData />)}
              {view === 'genel' && <GenelView rows={rows} />}
              {view === 'aylik' && <AylikView />}
              {view === 'karsilastirma' && <KarsilastirmaView />}
              {view === 'mus' && <MusView />}
              {view === 'yasam' && <YasamView />}
              {view === 'parsiyel' && <ParsiyelView />}
              {view === 'kapasite' && <KapasiteView />}
              {view === 'hedef' && <HedefView />}
              {view === 'rapor' && <RaporView />}
              {view === 'veri' && <UploadPanel />}
            </motion.div>
          </AnimatePresence>
        )}
      </Shell>
    </LoginGate>
  );
}

function NoData() {
  const { setView, syncState, syncError } = useSevkiyat();
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <EmptyState
        icon={<UploadCloud className="w-6 h-6" />}
        title="Henüz veri yok"
        desc={
          syncState === 'offline'
            ? 'Firebase\u2019e ulaşılamadı' + (syncError ? ': ' + syncError : '') + ' — bağlantınızı kontrol edin veya Excel Yükleme bölümünden devam edin.'
            : 'Analizleri görmek için Excel dosyanızı yükleyin. Şablon indirip kolonları doldurarak dakikalar içinde başlayabilirsiniz.'
        }
      />
      <div className="flex justify-center pb-6">
        <button
          onClick={() => setView('veri')}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
        >
          Excel Yükleme'ye Git
        </button>
      </div>
    </div>
  );
}

function BootSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
