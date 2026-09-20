'use client';

import React from 'react';
import { useIncidentStore } from '@/stores/useIncidentStore';

function IncidentSparkline() {
  const points = [12, 14, 11, 8, 5, 4, 3, 6, 9, 15, 22, 28, 31, 26, 29, 35, 42, 38, 45, 40, 48, 52, 49, 56];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const width = 110;
  const height = 26;
  const step = width / (points.length - 1);

  const pathD = points
    .map((val, idx) => {
      const x = idx * step;
      const y = height - ((val - min) / (max - min)) * (height - 6) - 3;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const lastY = height - ((points[points.length - 1] - min) / (max - min)) * (height - 6) - 3;

  return (
    <div
      className="hidden xl:flex items-center gap-2.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner"
      title="Incident Volume in the last 24 hours"
    >
      <div>
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
          24h Volume
        </div>
        <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
          <span>56 events</span>
          <span className="text-[10px] text-emerald-500 font-normal">▲+18%</span>
        </div>
      </div>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="headerSparklineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#headerSparklineGrad)" />
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        <circle cx={width} cy={lastY} r="3" fill="#10b981" className="animate-ping" />
        <circle cx={width} cy={lastY} r="2.5" fill="#34d399" />
      </svg>
    </div>
  );
}

export default function Header() {
  const isSimulatedOffline = useIncidentStore((s) => s.isSimulatedOffline);
  const setIsSimulatedOffline = useIncidentStore((s) => s.setIsSimulatedOffline);
  const toastMessage = useIncidentStore((s) => s.toastMessage);
  const setToastMessage = useIncidentStore((s) => s.setToastMessage);

  const handleToggleOffline = () => {
    if (isSimulatedOffline) {
      setIsSimulatedOffline(false);
      setToastMessage('🟢 Network Restored: Background sync completed. All pending reports synced!');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setIsSimulatedOffline(true);
      setToastMessage('⚠️ Offline Mode Simulated: Network requests will queue in IndexedDB.');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-6 flex items-center justify-between z-30 select-none">
        {/* Brand & Live Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-3.5 w-3.5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-lg shadow-emerald-500/50" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black tracking-tight text-white text-base">CivicPulse</h1>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PROD-ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              High-Concurrency Geospatial Event Mesh
            </p>
          </div>
        </div>

        {/* Center: 24h Mini SVG Sparkline */}
        <IncidentSparkline />

        {/* Right Controls: Offline Simulation & PWA Status */}
        <div className="flex items-center gap-3">
          {/* Yellow Pending Sync Badge if Offline */}
          {isSimulatedOffline && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              3 Reports Pending Sync
            </span>
          )}

          {/* Simulate Offline Toggle */}
          <button
            onClick={handleToggleOffline}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
              isSimulatedOffline
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle offline state simulation to test IndexedDB queueing"
          >
            <span>{isSimulatedOffline ? '📡' : '🌐'}</span>
            <span>{isSimulatedOffline ? 'Online Reconnect' : 'Simulate Offline'}</span>
          </button>

          {/* System Metadata Badges */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              PostGIS EPSG:4326
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-emerald-400">
              Zustand Mesh
            </span>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 border border-emerald-500/40 text-slate-100 shadow-2xl backdrop-blur text-xs font-mono">
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </>
  );
}
