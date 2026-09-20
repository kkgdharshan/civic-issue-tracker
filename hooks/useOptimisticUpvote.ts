'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CivicIssue } from '@/types/issue';
import { realtimeChannel } from '@/lib/realtime/broadcast';

interface UpvoteMutationContext {
  previousIssues?: CivicIssue[];
  previousSingleIssue?: CivicIssue;
}

export function useOptimisticUpvote(queryKeyFilter: unknown[]) {
  const queryClient = useQueryClient();

  return useMutation<CivicIssue, Error, string, UpvoteMutationContext>({
    mutationFn: async (issueId: string): Promise<CivicIssue> => {
      const res = await fetch(`/api/issues/${issueId}/upvote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || `Upvote rejected with status ${res.status}`);
      }

      return res.json();
    },

    // Step A: Optimistic Execution & Snapshot Capture
    onMutate: async (issueId: string): Promise<UpvoteMutationContext> => {
      // 1. Cancel in-flight queries so they don't overwrite optimistic data
      await queryClient.cancelQueries({ queryKey: queryKeyFilter });
      await queryClient.cancelQueries({ queryKey: ['issue', issueId] });

      // 2. Snapshot previous state for rollback
      const previousIssues = queryClient.getQueryData<CivicIssue[]>(queryKeyFilter);
      const previousSingleIssue = queryClient.getQueryData<CivicIssue>(['issue', issueId]);

      // 3. Optimistically mutate list cache
      let newCount = 0;
      if (previousIssues) {
        queryClient.setQueryData<CivicIssue[]>(queryKeyFilter, (old) => {
          if (!old) return [];
          return old.map((issue) => {
            if (issue.id === issueId) {
              const willUpvote = !issue.hasUpvoted;
              newCount = willUpvote ? issue.upvoteCount + 1 : Math.max(0, issue.upvoteCount - 1);
              return {
                ...issue,
                hasUpvoted: willUpvote,
                upvoteCount: newCount,
                version: issue.version + 1,
              };
            }
            return issue;
          });
        });
      }

      // 4. Optimistically mutate detail cache (if active)
      if (previousSingleIssue) {
        const willUpvote = !previousSingleIssue.hasUpvoted;
        newCount = willUpvote ? previousSingleIssue.upvoteCount + 1 : Math.max(0, previousSingleIssue.upvoteCount - 1);
        queryClient.setQueryData<CivicIssue>(['issue', issueId], {
          ...previousSingleIssue,
          hasUpvoted: willUpvote,
          upvoteCount: newCount,
          version: previousSingleIssue.version + 1,
        });
      }

      // Broadcast optimistic change across local tabs
      realtimeChannel.publish({
        type: 'UPVOTE_SYNC',
        payload: { issueId, upvoteCount: newCount },
      });

      return { previousIssues, previousSingleIssue };
    },

    // Step B: Error Rollback
    onError: (_err, issueId, context) => {
      if (context?.previousIssues) {
        queryClient.setQueryData(queryKeyFilter, context.previousIssues);
      }
      if (context?.previousSingleIssue) {
        queryClient.setQueryData(['issue', issueId], context.previousSingleIssue);
      }
    },

    // Step C: Authoritative Re-synchronization
    onSettled: (_data, _error, issueId) => {
      queryClient.invalidateQueries({ queryKey: queryKeyFilter });
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
    },
  });
}
