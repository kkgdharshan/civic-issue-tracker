import { INITIAL_MOCK_ISSUES } from '@/lib/data/mock-issues';
import { CivicIssue } from '@/types/issue';

// In-memory runtime store initialized with realistic civic data
declare global {
  var __CIVICPULSE_ISSUES_STORE__: CivicIssue[] | undefined;
}

export function getIssuesStore(): CivicIssue[] {
  if (!globalThis.__CIVICPULSE_ISSUES_STORE__) {
    globalThis.__CIVICPULSE_ISSUES_STORE__ = [...INITIAL_MOCK_ISSUES];
  }
  return globalThis.__CIVICPULSE_ISSUES_STORE__;
}
