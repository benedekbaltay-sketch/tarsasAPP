import React from 'react';
import { useApp } from '../context/AppContext';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export function CloudSyncBadge({ hideWhenSynced = false }) {
  const { isCloudSyncing, cloudSyncStatus, lastSyncTime, refreshFromCloud, forceSyncLocalToCloud, state, t } = useApp();
  const isEn = state.currentLang === 'en';

  if (hideWhenSynced && cloudSyncStatus !== 'error') {
    return null;
  }

  const formatTime = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const timeStr = formatTime(lastSyncTime);

  if (isCloudSyncing) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs animate-pulse select-none"
        title={t.sync_syncing || (isEn ? "Syncing data with cloud database..." : "Adatok szinkronizálása a központi felhővel...")}
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />
        <span className="hidden sm:inline">
          {t.sync_syncing || (isEn ? "Syncing..." : "Szinkronizálás...")}
        </span>
      </div>
    );
  }

  if (cloudSyncStatus === 'error') {
    return (
      <button
        onClick={() => refreshFromCloud(true)}
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold transition-all cursor-pointer shadow-xs select-none hover:shadow-sm"
        title={t.sync_retry_prompt || (isEn ? "Cloud sync failed. Click to retry syncing!" : "A felhő szinkronizáció sikertelen. Kattints az újrapróbálkozáshoz!")}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span className="hidden sm:inline">
          {t.sync_local_only || (isEn ? "Local only (cloud failed)" : "Helyi mentés (felhő hiba)")}
        </span>
        <span className="sm:hidden font-bold">⚠️</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => refreshFromCloud(true)}
      type="button"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200/70 text-emerald-800 text-xs font-medium transition-all cursor-pointer group shadow-2xs select-none hover:shadow-xs"
      title={
        isEn
          ? `All data is up to date${timeStr ? ` (last: ${timeStr})` : ''}. Click to refresh from cloud!`
          : `Minden adat naprakész és szinkronizálva van${timeStr ? ` (utolsó: ${timeStr})` : ''}. Kattints a frissítéshez!`
      }
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 group-hover:hidden flex-shrink-0" />
      <RefreshCw className="w-3.5 h-3.5 text-emerald-700 hidden group-hover:block transition-transform duration-300 group-hover:rotate-180 flex-shrink-0" />
      <span className="hidden sm:inline font-semibold">
        {t.sync_up_to_date || (isEn ? "Up to date" : "Naprakész")}
      </span>
      <span className="sm:hidden font-bold">✓</span>
    </button>
  );
}
