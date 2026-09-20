/**
 * CivicPulse Geospatial Calculation Suite
 * Tests Haversine spherical distance calculation and radial proximity filtering.
 */

function calculateHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

describe('Geospatial Engine Tests', () => {
  const SF_CIVIC_CENTER = { lat: 37.7793, lng: -122.4192 };
  const MARKET_AND_4TH = { lat: 37.7858, lng: -122.4065 };
  const OAKLAND_DOWNTOWN = { lat: 37.8044, lng: -122.2711 };

  it('should accurately compute distance between adjacent SF intersections (~1.3km)', () => {
    const distanceMeters = calculateHaversineMeters(
      SF_CIVIC_CENTER.lat,
      SF_CIVIC_CENTER.lng,
      MARKET_AND_4TH.lat,
      MARKET_AND_4TH.lng
    );

    // Approximate distance between Civic Center and 4th & Market is ~1340 meters
    expect(distanceMeters).toBeGreaterThan(1200);
    expect(distanceMeters).toBeLessThan(1500);
  });

  it('should include Market & 4th in a 5km radius search from Civic Center', () => {
    const distanceMeters = calculateHaversineMeters(
      SF_CIVIC_CENTER.lat,
      SF_CIVIC_CENTER.lng,
      MARKET_AND_4TH.lat,
      MARKET_AND_4TH.lng
    );

    expect(distanceMeters <= 5000).toBe(true);
  });

  it('should exclude Oakland Downtown (> 10km away across the bay) from a 5km radius search', () => {
    const distanceMeters = calculateHaversineMeters(
      SF_CIVIC_CENTER.lat,
      SF_CIVIC_CENTER.lng,
      OAKLAND_DOWNTOWN.lat,
      OAKLAND_DOWNTOWN.lng
    );

    expect(distanceMeters > 5000).toBe(true);
    expect(distanceMeters).toBeGreaterThan(12000); // ~13km
  });

  it('should return 0 meters for identical coordinates', () => {
    const distanceMeters = calculateHaversineMeters(
      SF_CIVIC_CENTER.lat,
      SF_CIVIC_CENTER.lng,
      SF_CIVIC_CENTER.lat,
      SF_CIVIC_CENTER.lng
    );

    expect(distanceMeters).toBe(0);
  });
});
