import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const { contentType, fileSizeBytes } = await req.json();

    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Only JPEG, PNG, and WebP are allowed' },
        { status: 415 }
      );
    }

    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'PAYLOAD_TOO_LARGE', message: 'Asset exceeds 10MB threshold' },
        { status: 413 }
      );
    }

    const fileId = crypto.randomUUID();
    const mockFileKey = `reports/${new Date().toISOString().split('T')[0]}/${fileId}.jpg`;

    // Direct presigned upload endpoint simulation
    return NextResponse.json(
      {
        uploadUrl: `/api/uploads/mock-s3-receiver?key=${mockFileKey}`,
        fileKey: mockFileKey,
        publicUrl: `https://cdn.civicpulse.internal/${mockFileKey}`,
        expiresInSeconds: 900,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: err.message }, { status: 400 });
  }
}
