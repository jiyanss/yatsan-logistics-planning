'use client';

/* Uygulama kabuğu: kenar çubuğu (masaüstü) + üst çubuk + mobil çekmece */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Ship, RefreshCw, Sun, Moon, LogOut, Menu, Download, FileDown,
  CircleCheck, CloudUpload, Loader2, UserRound, CloudOff, FlaskConical, Eye, Clock, ShieldX,
} from 'lucide-react';
import { useSevkiyat } from '@/lib/sevkiyat/store';
import { NAV } from './nav';
import { yetkiYazar, type ViewId, type Yetki } from '@/lib/sevkiyat/types';
import { nf0 } from '@/lib/sevkiyat/core';
import { downloadTemplate, exportReports } from '@/lib/sevkiyat/excel';
import { applyFilters } from '@/lib/sevkiyat/store';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Shell({ children }: { children: React.ReactNode }) {
  const { view, setView, syncState, syncError, data, fullReload, user, signOutUser, demoMode, exitDemo, misafir, yetki } = useSevkiyat();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const pathname = usePathname();
  void pathname;

  const go = (id: typeof view) => {
    setView(id);
    setMobileOpen(false);
  };

  const doReload = async () => {
    setReloading(true);
    await fullReload();
    setReloading(false);
    toast({ title: 'Firebase\u2019den yenilendi', description: nf0.format(useSevkiyat.getState().data.length) + ' kayıt yüklendi' });
  };

  const doExport = () => {
    const st = useSevkiyat.getState();
    const rows = applyFilters(st.data, st.filters);
    if (!rows.length) {
      toast({ title: 'Dışa aktarılacak veri yok', variant: 'destructive' });
      return;
    }
    const fname = exportReports(rows, st.data, st.targets, st.caps, null);
    toast({ title: 'Excel raporu indirildi', description: fname + ' (10 sayfa)' });
  };

  const pill = syncPill(syncState, data.length, syncError, demoMode, misafir, yetki);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Masaüstü kenar çubuğu */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <Brand />
        <SidebarNav current={view} go={go} misafir={misafir} yetki={yetki} />
        <SidebarFooter demoMode={demoMode} exitDemo={exitDemo} misafir={misafir} yetki={yetki} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Üst çubuk */}
        <header className="sticky top-0 z-40 h-14 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center gap-2 px-3 md:px-5">
          {/* Mobil menü */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground [&>button]:text-sidebar-foreground">
              <SheetTitle className="sr-only">Menü</SheetTitle>
              <div className="h-full flex flex-col">
                <Brand />
                <SidebarNav current={view} go={go} misafir={misafir} yetki={yetki} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="lg:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-500 flex items-center justify-center shrink-0">
              <Ship className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-tight truncate">İhracat Yükleme Paneli</div>
              <div className="hidden sm:block text-[11px] text-muted-foreground leading-tight">YATSAN · Sevkiyat Analitik</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            {pill}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={doReload} disabled={reloading} className="hidden sm:inline-flex">
                    {reloading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <RefreshCw className="w-4.5 h-4.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Firestore'dan tam yenile</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={downloadTemplate} className="hidden md:inline-flex">
                    <FileDown className="w-4.5 h-4.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Excel şablonu indir</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={doExport} className="hidden md:inline-flex">
                    <Download className="w-4.5 h-4.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Raporu Excel'e indir</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Tema değiştir"
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <span className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                    <UserRound className="w-4 h-4" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate">
                  {yetkiEtiket(demoMode, misafir, yetki, user)}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {demoMode ? (
                  <DropdownMenuItem onClick={exitDemo}>
                    <LogOut className="w-4 h-4 mr-2" /> Demo\u2019dan çık
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => void signOutUser()}>
                    <LogOut className="w-4 h-4 mr-2" /> Çıkış yap
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1500px] mx-auto p-3 md:p-5 flex flex-col gap-4">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border shrink-0">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
        <Ship className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="font-extrabold tracking-tight text-[15px] text-white leading-none">YATSAN</div>
        <div className="text-[10.5px] text-violet-300/70 mt-0.5">İhracat Yükleme Paneli</div>
      </div>
    </div>
  );
}

function SidebarNav({ current, go, misafir, yetki }: { current: string; go: (id: ViewId) => void; misafir: boolean; yetki: Yetki }) {
  const gizlenen = (id: ViewId): boolean => {
    if (id === 'kullanicilar') return yetki !== 'admin';
    if (id === 'veri') return misafir || !yetkiYazar(yetki);
    return false;
  };
  return (
    <nav className="flex-1 overflow-y-auto nice-scroll py-3 px-2.5 space-y-4">
      {NAV.map((g) => {
        const items = g.items.filter((it) => !gizlenen(it.id));
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <div className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300/50">{g.title}</div>
            <ul className="space-y-0.5">
              {items.map((it) => {
              const active = current === it.id;
              return (
                <li key={it.id}>
                  <Link
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      go(it.id);
                    }}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                      active
                        ? 'bg-sidebar-primary/15 text-sidebar-primary-foreground font-semibold ring-1 ring-sidebar-primary/30'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <it.icon className={cn('w-4 h-4 shrink-0', active ? 'text-sidebar-primary' : 'text-violet-300/60 group-hover:text-violet-300')} />
                    <span className="truncate">{it.label}</span>
                  </Link>
                </li>
              );
            })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ demoMode, exitDemo, misafir, yetki }: { demoMode: boolean; exitDemo: () => void; misafir: boolean; yetki: Yetki }) {
  return (
    <div className="p-3 border-t border-sidebar-border shrink-0 space-y-2">
      {yetki === 'bekliyor' && (
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Yönetici onayı bekliyor — salt okunur
        </div>
      )}
      {yetki === 'reddedildi' && (
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] bg-red-500/10 text-red-300 ring-1 ring-red-500/30">
          <ShieldX className="w-3.5 h-3.5 shrink-0" />
          Hesap onaylanmadı — salt okunur
        </div>
      )}
      {misafir && (
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          Misafir modu — salt okunur
        </div>
      )}
      {demoMode && (
        <button
          onClick={exitDemo}
          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/20 transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Demo modu — Firebase'e geç
        </button>
      )}
    </div>
  );
}

function yetkiEtiket(demoMode: boolean, misafir: boolean, yetki: Yetki, user: string | null): string {
  if (demoMode) return 'Demo modu';
  if (misafir || yetki === 'misafir') return 'Misafir · salt okunur';
  if (yetki === 'admin') return (user || '') + ' · Yönetici';
  if (yetki === 'onayli') return (user || '') + ' · Yetkili';
  if (yetki === 'bekliyor') return (user || '') + ' · Onay bekliyor';
  if (yetki === 'reddedildi') return (user || '') + ' · Onaylanmadı';
  return user || 'Misafir';
}

function syncPill(state: string, count: number, err: string, demoMode: boolean, misafir: boolean, yetki: Yetki) {
  if (demoMode) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30">
        <FlaskConical className="w-3 h-3" /> Demo · {nf0.format(count)} kayıt
      </span>
    );
  }
  if (yetki === 'bekliyor') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25">
        <Clock className="w-3 h-3" /> Onay bekliyor · {nf0.format(count)} kayıt
      </span>
    );
  }
  if (yetki === 'reddedildi') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-red-500/12 text-red-600 dark:text-red-400 ring-1 ring-red-500/25">
        <ShieldX className="w-3 h-3" /> Onaylanmadı · {nf0.format(count)} kayıt
      </span>
    );
  }
  if (misafir) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/25">
        <Eye className="w-3 h-3" /> Misafir · {nf0.format(count)} kayıt
      </span>
    );
  }
  if (state === 'synced') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25">
        <CircleCheck className="w-3 h-3" /> Firebase · {nf0.format(count)} kayıt
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/25">
        <Loader2 className="w-3 h-3 animate-spin" /> Senkron…
      </span>
    );
  }
  if (state === 'offline') {
    return (
      <span title={err} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-red-500/12 text-red-600 dark:text-red-400 ring-1 ring-red-500/25">
        <CloudOff className="w-3 h-3" /> Çevrimdışı
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-muted text-muted-foreground ring-1">
      <CloudUpload className="w-3 h-3" /> Bağlanıyor…
    </span>
  );
}
