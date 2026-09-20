import { Suspense } from 'react';
import Header from '@/components/layout/Header';
import LiveRadarDashboard from '@/components/dashboard/LiveRadarDashboard';
import MapSkeleton from '@/components/dashboard/MapSkeleton';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

export default function CivicPulsePage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Telemetry Header with 24h Sparkline and Offline Simulation */}
      <Header />

      {/* Main Interactive Dashboard inside Suspense & Error Boundary */}
      <ErrorBoundary fallbackTitle="Mission Control Crash">
        <Suspense fallback={<MapSkeleton />}>
          <LiveRadarDashboard />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}
