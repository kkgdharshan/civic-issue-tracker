// Web Worker for off-thread spatial index clustering
import { CivicIssue, ClusterFeature } from '../types/issue';

interface ClusterPoint {
  id: string;
  x: number;
  y: number;
  issue: CivicIssue;
}

// In-worker spatial grid clustering
class WorkerSpatialIndex {
  private points: ClusterPoint[] = [];

  public load(issues: CivicIssue[]) {
    this.points = issues.map((issue) => ({
      id: issue.id,
      x: issue.longitude,
      y: issue.latitude,
      issue,
    }));
  }

  public getClusters(bbox: [number, number, number, number], zoom: number): ClusterFeature[] {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const visiblePoints = this.points.filter(
      (p) => p.x >= minLng && p.x <= maxLng && p.y >= minLat && p.y <= maxLat
    );

    // Dynamic clustering threshold based on zoom level
    const cellSize = 360 / Math.pow(2, zoom + 2);
    const grid: Map<string, ClusterPoint[]> = new Map();

    for (const point of visiblePoints) {
      const cellX = Math.floor(point.x / cellSize);
      const cellY = Math.floor(point.y / cellSize);
      const key = `${cellX}:${cellY}`;

      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key)!.push(point);
    }

    const results: ClusterFeature[] = [];

    grid.forEach((cellPoints) => {
      if (cellPoints.length === 1) {
        const p = cellPoints[0].issue;
        results.push({
          type: 'Feature',
          properties: {
            cluster: false,
            issueId: p.id,
            status: p.status,
            severity: p.severity,
            title: p.title,
            point_count: 1,
          },
          geometry: {
            type: 'Point',
            coordinates: [p.longitude, p.latitude],
          },
        });
      } else {
        const avgLng = cellPoints.reduce((sum, p) => sum + p.x, 0) / cellPoints.length;
        const avgLat = cellPoints.reduce((sum, p) => sum + p.y, 0) / cellPoints.length;
        const hasEmergency = cellPoints.some((p) => p.issue.severity === 'CRITICAL_EMERGENCY');

        results.push({
          type: 'Feature',
          properties: {
            cluster: true,
            point_count: cellPoints.length,
            point_count_abbreviated: cellPoints.length > 99 ? '99+' : cellPoints.length,
            severity: hasEmergency ? 'CRITICAL_EMERGENCY' : 'MEDIUM',
          },
          geometry: {
            type: 'Point',
            coordinates: [avgLng, avgLat],
          },
        });
      }
    });

    return results;
  }
}

const spatialIndex = new WorkerSpatialIndex();

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INDEX_ISSUES': {
      const issues: CivicIssue[] = payload.issues || [];
      spatialIndex.load(issues);
      self.postMessage({
        type: 'INDEXED_SUCCESS',
        count: issues.length,
      });
      break;
    }

    case 'GET_CLUSTERS': {
      const { bbox, zoom }: { bbox: [number, number, number, number]; zoom: number } = payload;
      const clusters = spatialIndex.getClusters(bbox, zoom);
      self.postMessage({
        type: 'CLUSTERS_DATA',
        clusters,
      });
      break;
    }

    default:
      break;
  }
};
