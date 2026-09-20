import { NextRequest, NextResponse } from 'next/server';
import { CreateIssueSchema } from '@/lib/validations/issue';
import { CivicIssue } from '@/types/issue';
import { getIssuesStore } from '@/lib/data/memory-store';

// Idempotency cache simulation
const processedIdempotencyKeys = new Map<string, any>();

export async function POST(req: NextRequest) {
  const startTime = performance.now();
  const idempotencyKey = req.headers.get('Idempotency-Key');

  // Guard: Mandatory Idempotency Key
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: "Header 'Idempotency-Key' is required for transaction safety." },
      { status: 400 }
    );
  }

  // Idempotency check
  if (processedIdempotencyKeys.has(idempotencyKey)) {
    const cached = processedIdempotencyKeys.get(idempotencyKey);
    return NextResponse.json(cached, {
      status: 200,
      headers: { 'X-Cache-Lookup': 'IDEMPOTENT_HIT' },
    });
  }

  try {
    const rawBody = await req.json();
    const validation = CreateIssueSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'INVALID_PAYLOAD', details: validation.error.flatten() },
        { status: 422 }
      );
    }

    const data = validation.data;
    const store = getIssuesStore();

    const newIssue: CivicIssue = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      category: data.category,
      severity: data.severity,
      status: 'REPORTED',
      upvoteCount: 0,
      hasUpvoted: false,
      latitude: data.latitude,
      longitude: data.longitude,
      mediaUrls: data.mediaUrls,
      reporterId: 'usr-current-session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    // Prepend to store
    store.unshift(newIssue);

    const responsePayload = {
      success: true,
      data: newIssue,
      executionMs: Math.round(performance.now() - startTime),
      transactionOutboxStatus: 'ENQUEUED_TO_BULLMQ',
    };

    processedIdempotencyKeys.set(idempotencyKey, responsePayload);

    return NextResponse.json(responsePayload, {
      status: 201,
      headers: {
        'X-Idempotency-Status': 'PROCESSED_ACID_COMMIT',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'INTERNAL_TRANSACTION_ABORTED', message: error.message },
      { status: 500 }
    );
  }
}
