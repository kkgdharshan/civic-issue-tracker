'use client';

import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CivicIssue } from '@/types/issue';
import { IssueFeedCard } from './IssueFeedCard';
import { useIncidentStore } from '@/stores/useIncidentStore';

interface VirtualizedFeedProps {
  issues: CivicIssue[];
  isLoading: boolean;
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  onUpvote: (id: string) => void;
  isUpvotePending: boolean;
  onResolveIssue?: (id: string) => void;
}

export const VirtualizedFeed = React.memo(function VirtualizedFeed({
  issues,
  isLoading,
  selectedIssueId,
  onSelectIssue,
  onUpvote,
  isUpvotePending,
  onResolveIssue,
}: VirtualizedFeedProps) {
  const parentScrollRef = useRef<HTMLDivElement>(null);

  const scrollToIncidentId = useIncidentStore((s) => s.scrollToIncidentId);
  const setScrollToIncidentId = useIncidentStore((s) => s.setScrollToIncidentId);

  const rowVirtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => parentScrollRef.current,
    estimateSize: () => 140,
    overscan: 5,
  });

  // Bi-directional sync: scroll to card when map marker is clicked
  useEffect(() => {
    if (!scrollToIncidentId) return;
    const targetIndex = issues.findIndex((i) => i.id === scrollToIncidentId);
    if (targetIndex !== -1) {
      rowVirtualizer.scrollToIndex(targetIndex, { align: 'center', behavior: 'smooth' });
    }
    const timer = setTimeout(() => {
      setScrollToIncidentId(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [scrollToIncidentId, issues, rowVirtualizer, setScrollToIncidentId]);

  return (
    <div
      ref={parentScrollRef}
      tabIndex={0}
      role="feed"
      aria-busy={isLoading}
      aria-label="Civic Telemetry Incident Stream"
      className="flex-1 overflow-y-auto px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-700 scrollbar-thin scrollbar-thumb-slate-800"
    >
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
          <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono">Synchronizing spatial sector feed...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center p-6 text-slate-500">
          <p className="text-xs font-semibold text-slate-400">Sector Clear</p>
          <p className="text-[11px] mt-1">No active civic anomalies recorded within the active spatial boundary.</p>
        </div>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const issue = issues[virtualRow.index];
            const isSelected = issue.id === selectedIssueId;

            return (
              <div
                key={issue.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="pb-2.5"
              >
                <IssueFeedCard
                  issue={issue}
                  isSelected={isSelected}
                  onSelect={onSelectIssue}
                  onUpvote={onUpvote}
                  isUpvotePending={isUpvotePending}
                  onResolve={onResolveIssue}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
