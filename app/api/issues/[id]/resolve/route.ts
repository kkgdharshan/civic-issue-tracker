import { NextRequest, NextResponse } from 'next/server';
import { getIssuesStore } from '../../nearby/route';

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

  issue.status = 'RESOLVED';
  issue.version += 1;
  issue.updatedAt = new Date().toISOString();

  return NextResponse.json(issue, { status: 200 });
}
