import { NextRequest, NextResponse } from 'next/server';
import { getIssuesStore } from '@/lib/data/memory-store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const issueId = params.id;
  const store = getIssuesStore();

  const issue = store.find((i) => i.id === issueId);
  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  // Toggle upvote state atomically
  const willUpvote = !issue.hasUpvoted;
  issue.hasUpvoted = willUpvote;
  issue.upvoteCount = willUpvote ? issue.upvoteCount + 1 : Math.max(0, issue.upvoteCount - 1);
  issue.version += 1;
  issue.updatedAt = new Date().toISOString();

  return NextResponse.json(issue, { status: 200 });
}
