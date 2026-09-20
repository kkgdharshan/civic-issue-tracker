'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CivicIssue } from '@/types/issue';
import { useIncidentStore } from '@/stores/useIncidentStore';

interface IssueFeedCardProps {
  issue: CivicIssue;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpvote: (id: string) => void;
  isUpvotePending: boolean;
  onResolve?: (id: string) => void;
}

function getRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const IssueFeedCard = React.memo(function IssueFeedCard({
  issue,
  isSelected,
  onSelect,
  onUpvote,
  isUpvotePending,
  onResolve,
}: IssueFeedCardProps) {
  const setHoveredIncidentId = useIncidentStore((s) => s.setHoveredIncidentId);
  const setSelectedIncidentId = useIncidentStore((s) => s.setSelectedIncidentId);

  const [imageLoading, setImageLoading] = useState(true);

  const isEmergency = issue.severity === 'CRITICAL_EMERGENCY';
  const isResolved = issue.status === 'RESOLVED';
  const isEscalated =
    Date.now() - new Date(issue.createdAt).getTime() > 24 * 60 * 60 * 1000 &&
    issue.status === 'REPORTED';

  const relativeTime = getRelativeTime(issue.createdAt);
  const thumbnailUrl = issue.mediaUrls && issue.mediaUrls.length > 0 ? issue.mediaUrls[0] : null;

  return (
    <article
      tabIndex={0}
      role="listitem"
      aria-selected={isSelected}
      onMouseEnter={() => setHoveredIncidentId(issue.id)}
      onMouseLeave={() => setHoveredIncidentId(null)}
      onClick={() => {
        onSelect(issue.id);
        setSelectedIncidentId(issue.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(issue.id);
          setSelectedIncidentId(issue.id);
        }
      }}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${
        isEscalated
          ? 'ring-2 ring-rose-500/80 border-rose-500/80 bg-rose-950/20 shadow-[0_0_16px_rgba(244,63,94,0.35)]'
          : isSelected
          ? 'border-emerald-500/80 bg-slate-900 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
          : isEmergency
          ? 'border-rose-500/30 bg-rose-950/10 hover:border-rose-500/50'
          : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {/* Escalated Badge */}
            {isEscalated && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded tracking-wide uppercase bg-rose-500/25 text-rose-300 border border-rose-500/60 animate-pulse flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
                🚨 ESCALATED (&gt;24H)
              </span>
            )}

            {/* Status Badge */}
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-wide uppercase transition-colors duration-500 ${
                isResolved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isEmergency
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {issue.status}
            </span>

            {/* AI Confidence & Category Badge */}
            <div className="relative group/ai inline-flex items-center">
              <span className="text-[10px] font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 flex items-center gap-1">
                {issue.category}
                <span className="cursor-help text-emerald-400 hover:text-emerald-300 transition-colors">✨</span>
              </span>

              {/* Hover Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/ai:flex flex-col items-center z-50 pointer-events-none">
                <div className="px-2.5 py-1 rounded-md bg-slate-900/95 border border-emerald-500/40 text-[10px] font-sans font-medium text-emerald-300 shadow-xl backdrop-blur whitespace-nowrap">
                  AI Categorized ({Math.round((issue.aiConfidence ?? 0.94) * 100)}% Confidence)
                </div>
                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900 border-r border-b border-emerald-500/40" />
              </div>
            </div>

            {/* Relative Time Stamp */}
            <span className="text-[10px] font-mono text-slate-400">
              {relativeTime}
            </span>

            {issue.distanceMeters && (
              <span className="text-[10px] font-mono text-slate-500">
                {Math.round(issue.distanceMeters)}m
              </span>
            )}
          </div>

          <h3 className="text-xs font-semibold text-white truncate leading-snug">{issue.title}</h3>
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            {issue.description}
          </p>

          {/* Action pills */}
          <div className="mt-2.5 flex items-center gap-2.5">
            {!isResolved && onResolve && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(issue.id);
                }}
                className="text-[10px] font-semibold text-slate-400 hover:text-emerald-400 underline decoration-slate-700 hover:decoration-emerald-400 transition-colors"
              >
                Mark Resolved
              </button>
            )}
            <span className="text-[10px] font-mono text-slate-600">v{issue.version}</span>
          </div>
        </div>

        {/* Media & Proof Thumbnail with Skeleton Loader */}
        {thumbnailUrl && (
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700/80 aspect-square">
            {imageLoading && (
              <div className="absolute inset-0 bg-slate-800/90 animate-pulse flex items-center justify-center">
                <span className="h-4 w-4 rounded-full border-2 border-slate-600 border-t-emerald-400 animate-spin" />
              </div>
            )}
            <Image
              src={thumbnailUrl}
              alt={issue.title}
              fill
              sizes="80px"
              unoptimized
              onLoad={() => setImageLoading(false)}
              className={`object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
            />
          </div>
        )}

        {/* Optimistic Upvote Trigger */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpvote(issue.id);
          }}
          disabled={isUpvotePending}
          aria-label={`Upvote issue: currently has ${issue.upvoteCount} votes`}
          className={`flex flex-col items-center justify-center min-w-[44px] px-2 py-2 rounded-lg border text-[11px] font-bold transition-transform active:scale-95 ${
            issue.hasUpvoted
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-xs leading-none">▲</span>
          <span className="mt-0.5 font-mono">{issue.upvoteCount}</span>
        </button>
      </div>
    </article>
  );
});
