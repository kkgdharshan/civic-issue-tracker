import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const radiusParam = searchParams.get('radius');

  const centerLat = latParam ? parseFloat(latParam) : 10.9757;
  const centerLng = lngParam ? parseFloat(lngParam) : 77.9398;
  const radiusMeters = radiusParam ? parseFloat(radiusParam) : 8000;

  const store = getIssuesStore();

  // Calculate haversine spherical distance simulating PostGIS ST_DWithin
  const issuesWithDistance = store.map((issue) => {
    const dLat = ((issue.latitude - centerLat) * Math.PI) / 180;
    const dLng = ((issue.longitude - centerLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((centerLat * Math.PI) / 180) *
        Math.cos((issue.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = 6371000 * c; // Earth radius in meters

    return {
      ...issue,
      distanceMeters,
    };
  });

  // Filter within radius and sort by closest
  const nearby = issuesWithDistance
    .filter((issue) => issue.distanceMeters <= radiusMeters)
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

  return NextResponse.json(nearby, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      'X-Spatial-Engine': 'PostGIS-EPSG:4326-Simulation',
    },
  });
}
