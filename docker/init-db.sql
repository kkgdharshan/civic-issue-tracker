-- CivicPulse PostGIS Spatial Database Initialization
-- Author: Staff Software Engineer / FAANG Architect

-- 1. Enable Core Spatial & UUID Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Spatial GiST (Generalized Search Tree) Index
-- Prevents full table scan on spatial queries across multi-million row datasets
CREATE INDEX IF NOT EXISTS idx_issue_location_gist 
ON "Issue" 
USING GIST (location);

-- 3. Automatic Synchronization Trigger: scalar (lat/lng) <-> PostGIS geography(Point, 4326)
CREATE OR REPLACE FUNCTION sync_issue_postgis_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_issue_location ON "Issue";
CREATE TRIGGER trg_sync_issue_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON "Issue"
FOR EACH ROW
EXECUTE FUNCTION sync_issue_postgis_location();

-- 4. High-Performance Proximity Function (5km Radius with ST_DWithin)
-- Uses spherical ellipsoidal distance over WGS84 geography
CREATE OR REPLACE FUNCTION get_issues_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 5000.0,
  max_limit INT DEFAULT 50,
  filter_status "IssueStatus" DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(150),
  description TEXT,
  category VARCHAR(64),
  status "IssueStatus",
  severity "Severity",
  upvote_count INT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.title,
    i.description,
    i.category,
    i.status,
    i.severity,
    i."upvoteCount",
    i.latitude,
    i.longitude,
    ST_Distance(
      i.location, 
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) AS distance_meters,
    i."createdAt"
  FROM "Issue" i
  WHERE 
    ST_DWithin(
      i.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
    AND (filter_status IS NULL OR i.status = filter_status)
  ORDER BY distance_meters ASC
  LIMIT max_limit;
END;
$$ LANGUAGE plpgsql STABLE;
