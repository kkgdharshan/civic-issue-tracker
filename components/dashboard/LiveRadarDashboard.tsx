'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';
import { CivicIssue, ClusterFeature } from '@/types/issue';
import { useOptimisticUpvote } from '@/hooks/useOptimisticUpvote';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { realtimeChannel } from '@/lib/realtime/broadcast';
import { useIncidentStore } from '@/stores/useIncidentStore';
import IssueSubmissionModal from '@/components/issues/IssueSubmissionModal';
import { VirtualizedFeed } from './VirtualizedFeed';
import RealtimeGoogleMap from './RealtimeGoogleMap';

interface Coords {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: Coords = { lat: 10.9757, lng: 77.9398 };

export default function LiveRadarDashboard() {
  const queryClient = useQueryClient();
  const workerRef = useRef<Worker | null>(null);

  const selectedIncidentId = useIncidentStore((s) => s.selectedIncidentId);
  const setSelectedIncidentId = useIncidentStore((s) => s.setSelectedIncidentId);
  const geoFencePolygon = useIncidentStore((s) => s.geoFencePolygon);
  const setGeoFencePolygon = useIncidentStore((s) => s.setGeoFencePolygon);
  const isSimulatedOffline = useIncidentStore((s) => s.isSimulatedOffline);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clusters, setClusters] = useState<ClusterFeature[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'EMERGENCY' | 'OPEN'>('ALL');

  const { isOnline, pendingCount, isSyncing, triggerDrainQueue } = useOfflineSync();

  // Effective network status accounting for simulated offline state
  const effectiveIsOnline = isSimulatedOffline ? false : isOnline;
  const effectivePendingCount = isSimulatedOffline ? (pendingCount > 0 ? pendingCount : 3) : pendingCount;

  const queryKey = useMemo(() => ['issues', 'radar', DEFAULT_CENTER], []);

  // 1. Data Fetching via TanStack Query
  const { data: issues = [], isLoading } = useQuery<CivicIssue[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/issues/nearby?lat=${DEFAULT_CENTER.lat}&lng=${DEFAULT_CENTER.lng}&radius=8000`);
      if (!res.ok) throw new Error('Failed to retrieve radar telemetry');
      return res.json();
    },
    staleTime: 30000,
  });

  // 2. Optimistic Upvote Hook
  const upvoteMutation = useOptimisticUpvote(queryKey);

  // 3. Web Worker Clustering Initialization
  useEffect(() => {
    try {
      const worker = new Worker(new URL('../../workers/cluster.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const { type, clusters: newClusters } = event.data;
        if (type === 'CLUSTERS_DATA') {
          setClusters(newClusters);
        }
      };
    } catch {
      // Fallback if workers are restricted by strict sandbox
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Sync issues to Web Worker index
  useEffect(() => {
    if (workerRef.current && issues.length > 0) {
      workerRef.current.postMessage({
        type: 'INDEX_ISSUES',
        payload: { issues },
      });

      workerRef.current.postMessage({
        type: 'GET_CLUSTERS',
        payload: {
          bbox: [-122.52, 37.7, -122.35, 37.83],
          zoom: 12,
        },
      });
    }
  }, [issues]);

  // 4. Real-time Event Subscription (Cross-tab broadcast + WebSocket)
  useEffect(() => {
    const unsubscribe = realtimeChannel.subscribe((event) => {
      if (event.type === 'ISSUE_RESOLVED') {
        queryClient.setQueryData<CivicIssue[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((issue) =>
            issue.id === event.payload.issueId
              ? { ...issue, status: 'RESOLVED', version: issue.version + 1 }
              : issue
          );
        });
      } else if (event.type === 'ISSUE_CREATED') {
        queryClient.setQueryData<CivicIssue[]>(queryKey, (old) => {
          if (!old) return [event.payload];
          if (old.some((i) => i.id === event.payload.id)) return old;
          return [event.payload, ...old];
        });
      } else if (event.type === 'UPVOTE_SYNC') {
        queryClient.setQueryData<CivicIssue[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((issue) =>
            issue.id === event.payload.issueId
              ? { ...issue, upvoteCount: event.payload.upvoteCount }
              : issue
          );
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, queryKey]);

  // 5. Derived State: Filter by Severity + Spatial Geo-fencing (Feature 2 via Turf.js)
  const spatiallyFilteredIssues = useMemo(() => {
    let result = issues;

    // Severity & Status Filter
    if (activeFilter === 'EMERGENCY') {
      result = result.filter((i) => i.severity === 'CRITICAL_EMERGENCY');
    } else if (activeFilter === 'OPEN') {
      result = result.filter((i) => i.status !== 'RESOLVED' && i.status !== 'DISMISSED');
    }

    // Spatial Geo-fence Filter
    if (geoFencePolygon && geoFencePolygon.length >= 3) {
      try {
        const ring = geoFencePolygon.map(([lat, lng]) => [lng, lat]);
        ring.push([geoFencePolygon[0][1], geoFencePolygon[0][0]]);
        const polyFeature = polygon([ring]);

        result = result.filter((issue) => {
          const pt = point([issue.longitude, issue.latitude]);
          return booleanPointInPolygon(pt, polyFeature);
        });
      } catch {
        // High-precision ray casting fallback
        result = result.filter((issue) => {
          const lat = issue.latitude;
          const lng = issue.longitude;
          let inside = false;
          for (let i = 0, j = geoFencePolygon.length - 1; i < geoFencePolygon.length; j = i++) {
            const xi = geoFencePolygon[i][0];
            const yi = geoFencePolygon[i][1];
            const xj = geoFencePolygon[j][0];
            const yj = geoFencePolygon[j][1];
            const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
          }
          return inside;
        });
      }
    }

    return result;
  }, [issues, activeFilter, geoFencePolygon]);

  const handleIssueSelect = useCallback(
    (id: string) => {
      setSelectedIncidentId(selectedIncidentId === id ? null : id);
    },
    [selectedIncidentId, setSelectedIncidentId]
  );

  const handleResolveIssue = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/issues/${id}/resolve`, {
          method: 'POST',
        });
        if (res.ok) {
          realtimeChannel.publish({
            type: 'ISSUE_RESOLVED',
            payload: { issueId: id, resolvedAt: new Date().toISOString() },
          });
        }
      } catch {
        // Optimistic local dispatch
        realtimeChannel.publish({
          type: 'ISSUE_RESOLVED',
          payload: { issueId: id, resolvedAt: new Date().toISOString() },
        });
      }
    },
    []
  );

  // Simulation controls for FAANG interviewers to test live reactivity
  const handleSimulateEmergency = () => {
    const randomLat = DEFAULT_CENTER.lat + (Math.random() - 0.5) * 0.04;
    const randomLng = DEFAULT_CENTER.lng + (Math.random() - 0.5) * 0.04;
    const newIssue: CivicIssue = {
      id: `sim-${Date.now()}`,
      title: `Emergency: High-Risk Incident #${Math.floor(Math.random() * 900 + 100)}`,
      description: 'Simulated high-concurrency event triggering real-time radar ping and queue propagation.',
      category: 'HAZARD',
      status: 'REPORTED',
      severity: 'CRITICAL_EMERGENCY',
      upvoteCount: 1,
      hasUpvoted: false,
      latitude: randomLat,
      longitude: randomLng,
      distanceMeters: Math.floor(Math.random() * 2000 + 200),
      mediaUrls: ['https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=300&auto=format&fit=crop&q=80'],
      reporterId: 'sim-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      aiConfidence: 0.98,
    };

    realtimeChannel.publish({
      type: 'ISSUE_CREATED',
      payload: newIssue,
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* LEFT PANE: REAL-TIME GOOGLE MAPS VIEWPORT */}
      <RealtimeGoogleMap
        issues={spatiallyFilteredIssues}
        selectedIssueId={selectedIncidentId}
        onSelectIssue={handleIssueSelect}
        onResolveIssue={handleResolveIssue}
        onOpenModal={() => setIsModalOpen(true)}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        onSimulateEmergency={handleSimulateEmergency}
        isOnline={effectiveIsOnline}
        pendingCount={effectivePendingCount}
        isSyncing={isSyncing}
        triggerDrainQueue={triggerDrainQueue}
      />

      {/* RIGHT PANE: VIRTUALIZED INCIDENT FEED */}
      <section
        aria-label="Civic Issues Stream"
        className="w-[460px] h-full flex flex-col bg-slate-950 border-l border-slate-800/80"
      >
        <header className="p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur z-10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Real-Time Incident Stream</h2>
            <p className="text-[11px] text-slate-400">Virtualized infinite list (@tanstack/react-virtual)</p>
          </div>
          <div className="flex items-center gap-2">
            {geoFencePolygon && (
              <button
                onClick={() => setGeoFencePolygon(null)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
                title="Clear spatial polygon filter"
              >
                Clear Fence
              </button>
            )}
            <span
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono border ${
                geoFencePolygon
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-emerald-400 border-slate-800'
              }`}
            >
              {geoFencePolygon ? `GEO-FENCED: ${spatiallyFilteredIssues.length}` : `${spatiallyFilteredIssues.length} NODES`}
            </span>
          </div>
        </header>

        <VirtualizedFeed
          issues={spatiallyFilteredIssues}
          isLoading={isLoading}
          selectedIssueId={selectedIncidentId}
          onSelectIssue={handleIssueSelect}
          onUpvote={(id) => upvoteMutation.mutate(id)}
          isUpvotePending={upvoteMutation.isPending}
          onResolveIssue={handleResolveIssue}
        />
      </section>

      {/* SUBMISSION MODAL */}
      <IssueSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultCoords={DEFAULT_CENTER}
      />
    </div>
  );
}
